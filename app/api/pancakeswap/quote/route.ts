import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const PANCAKESWAP_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const BSC_NETWORK = ethers.Network.from({ chainId: 56, name: "binance" });

const BSC_RPC_URLS = (() => {
  const urls: string[] = [];
  
  // Add Alchemy FIRST for swap operations (most reliable)
  if (process.env.ALCHEMY_API_KEY) {
    urls.push(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  }
  
  // Fallback public endpoints (eth_call supported; meowrpc does not support eth_call)
  urls.push(
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed2.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://bsc-dataseed1.ninicoin.io",
    "https://bsc.publicnode.com",
    "https://bsc.llamarpc.com",
    "https://bsc-dataseed-public.bnbchain.org",
  );
  
  return urls;
})();

// Encode getAmountsOut and decode result manually. Use raw eth_call to avoid any provider ENS/populate logic (BSC doesn't support ENS).
const ROUTER_IFACE = new ethers.Interface([
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
]);

/** Validate and normalize address to 0x + 40 hex chars */
function validateAddress(addr: string): string {
  if (!addr || typeof addr !== "string") {
    throw new Error("Address must be a non-empty string");
  }
  
  const trimmed = addr.trim();
  
  // Check if it looks like an address (0x followed by 40 hex chars)
  if (!/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
    throw new Error(`Invalid address format: ${addr}`);
  }
  
  try {
    // Use ethers.js to validate and checksum the address
    return ethers.getAddress(trimmed);
  } catch (e) {
    // If checksum fails but format is valid, just return lowercase
    return trimmed.toLowerCase();
  }
}

/** Normalize to 0x + 40 hex chars for eth_call (skip EIP-55 checksum to avoid INVALID_ARGUMENT) */
function toHexAddress(addr: string): string {
  const validated = validateAddress(addr);
  return validated.toLowerCase();
}

const RPC_FETCH_MS = 12_000;

/** Ensure address is properly formatted as 0x + 40 lowercase hex chars */
function formatAddressForRpc(addr: string): string {
  // Remove any whitespace
  const trimmed = addr.trim();
  
  // Ensure it starts with 0x
  const withPrefix = trimmed.startsWith("0x") ? trimmed : "0x" + trimmed;
  
  // Remove 0x, convert to lowercase, and ensure exactly 40 hex chars
  const hex = withPrefix.slice(2).toLowerCase();
  
  if (hex.length !== 40) {
    throw new Error(`Address must be exactly 40 hex characters (got ${hex.length}): ${addr}`);
  }
  
  return "0x" + hex;
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  try {
    // Ensure address is properly formatted for RPC
    const formattedTo = formatAddressForRpc(to);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_FETCH_MS);
    
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: formattedTo, data }, "latest"],
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const json = await res.json();
    
    if (json.error) {
      throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`);
    }
    
    const result = json.result;
    
    // Log empty responses for debugging
    if (!result || result === "0x") {
      console.debug(`eth_call returned empty result from ${rpcUrl.substring(0, 60)}... (to: ${formattedTo}, data: ${data.substring(0, 100)}...)`);
      throw new Error(`eth_call returned empty data (0x) - contract may not exist or call reverted`);
    }
    
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

async function getAmountsOutWithFallback(
  path: string[],
  amountIn: bigint,
): Promise<bigint[]> {
  // Validate all addresses in the path
  const validatedPath: string[] = [];
  for (let i = 0; i < path.length; i++) {
    try {
      validatedPath.push(validateAddress(path[i]));
    } catch (error) {
      throw new Error(`Invalid address at path[${i}]: ${path[i]} - ${(error as Error).message}`);
    }
  }
  
  // Encode function call with validated addresses (ethers.js will handle checksumming)
  const calldata = ROUTER_IFACE.encodeFunctionData("getAmountsOut", [amountIn, validatedPath]);
  const to = PANCAKESWAP_ROUTER_ADDRESS.toLowerCase();
  
  console.log(`Calling getAmountsOut on router ${to} with path: [${validatedPath.join(", ")}] and amountIn: ${amountIn}`);
  console.log(`Encoded call data: ${calldata}`);
  
  const errors: Map<string, string> = new Map();

  // Try each RPC endpoint with a short delay between attempts
  for (let i = 0; i < BSC_RPC_URLS.length; i++) {
    const rpcUrl = BSC_RPC_URLS[i];
    
    try {
      const result = await ethCall(rpcUrl, to, calldata);
      
      // Successful call - decode the result
      const amounts = ROUTER_IFACE.decodeFunctionResult("getAmountsOut", result)[0] as bigint[];
      console.log(`Successfully fetched amounts from RPC ${i + 1}: ${rpcUrl.substring(0, 50)}... Result: [${amounts.join(", ")}]`);
      return amounts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.set(rpcUrl.split("//")[1] || rpcUrl, errorMsg);
      console.warn(`RPC ${i + 1}/${BSC_RPC_URLS.length} (${rpcUrl.substring(0, 50)}...) failed: ${errorMsg}`);
      
      // Add small delay between retries (except on last attempt)
      if (i < BSC_RPC_URLS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // All RPCs failed
  const errorSummary = Array.from(errors.entries())
    .map(([url, msg]) => `${url}: ${msg}`)
    .join("; ");
  
  throw new Error(`All RPC endpoints failed to fetch amounts. Errors: ${errorSummary}`);
}

export async function POST(request: NextRequest) {
  try {
    const { path, amountIn, slippage } = await request.json();

    if (!path || !amountIn) {
      return NextResponse.json(
        { error: "Missing path or amountIn" },
        { status: 400 },
      );
    }

    if (!Array.isArray(path) || path.length < 2) {
      return NextResponse.json(
        { error: "Invalid path: must be an array of addresses" },
        { status: 400 },
      );
    }

    // Validate path addresses (don't normalize yet - encodeFunctionData needs proper format)
    try {
      for (let i = 0; i < path.length; i++) {
        validateAddress(path[i]);
      }
    } catch (error) {
      return NextResponse.json(
        { error: `Invalid address in path: ${(error as Error).message}` },
        { status: 400 },
      );
    }

    // Convert amountIn to wei
    let amountInWei: bigint;
    try {
      // Ensure amountIn is a string and trim whitespace
      const amountInStr = String(amountIn).trim();
      
      // Validate it's a valid number
      if (!amountInStr || isNaN(parseFloat(amountInStr))) {
        throw new Error(`amountIn is not a valid number: "${amountIn}"`);
      }
      
      // Use parseEther to convert to wei
      amountInWei = ethers.parseEther(amountInStr);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to parse amountIn "${amountIn}":`, errorMsg);
      return NextResponse.json(
        { error: `Invalid amountIn format: ${errorMsg}` },
        { status: 400 },
      );
    }

    // Use provided slippage or default to 0.5%
    const slippagePercentage = slippage ?? 0.5;

    try {
      // Get amounts out with fallback RPC support
      const amounts = await getAmountsOutWithFallback(path, amountInWei);
      const amountOut = ethers.formatEther(amounts[amounts.length - 1]);

      // Calculate minimum amount with provided slippage (or default 0.5%)
      const minimumAmountOut = (
        parseFloat(amountOut) *
        (1 - slippagePercentage / 100)
      ).toString();

      // Calculate price impact
      const inputValue = parseFloat(amountIn);
      const outputValue = parseFloat(amountOut);
      const priceImpact = (inputValue - outputValue) / inputValue * 100;

      // Normalize addresses for response
      const normalizedPath = path.map((addr: string) => validateAddress(addr).toLowerCase());

      return NextResponse.json({
        amountIn,
        amountOut,
        minimumAmountOut,
        priceImpact,
        path: normalizedPath,
      });
    } catch (rpcError) {
      const errorMsg = rpcError instanceof Error ? rpcError.message : String(rpcError);
      console.error("RPC error fetching swap quote:", errorMsg);
      
      // Fallback: return mock quote for development
      console.warn("RPC failed, returning mock quote for development purposes");
      
      const mockAmountOut = (parseFloat(amountIn) * 0.9).toString(); // Assume 10% slippage for mock
      const minimumAmountOut = (parseFloat(mockAmountOut) * (1 - slippagePercentage / 100)).toString();

      // Normalize addresses for response
      const normalizedPath = path.map((addr: string) => validateAddress(addr).toLowerCase());

      return NextResponse.json({
        amountIn,
        amountOut: mockAmountOut,
        minimumAmountOut,
        priceImpact: 10,
        path: normalizedPath,
        warning: "Using mock quote - RPC unavailable",
      }, { status: 200 });
    }
  } catch (error) {
    console.error("Error fetching swap quote:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch swap quote", 
        details: (error as Error).message 
      },
      { status: 500 },
    );
  }
}
