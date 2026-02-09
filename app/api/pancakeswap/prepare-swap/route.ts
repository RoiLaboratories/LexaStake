import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const PANCAKESWAP_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const UNIVERSAL_ROUTER_ADDRESS = "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB";
const WBNB_ADDRESS = "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c";

const BSC_RPC_URLS = (() => {
  const urls: string[] = [];
  
  // Add Alchemy if API key is available
  if (process.env.ALCHEMY_API_KEY) {
    urls.push(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  }
  
  // Add fallback public endpoints
  urls.push(
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed2.binance.org",
    "https://bsc.publicnode.com",
    "https://rpc.ankr.com/bsc",
  );
  
  return urls;
})();

const BSC_NETWORK = ethers.Network.from({ chainId: 56, name: "binance" });
const BSC_RPC_URL = BSC_RPC_URLS[0];

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

/** Validate and normalize address */
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

/** BSC has no ENS; use a runner that never resolves names so contract calls don't throw */
function makeBscRunner(provider: ethers.Provider): ethers.ContractRunner {
  return {
    provider,
    call: (tx: ethers.TransactionRequest) => provider.call(tx),
    resolveName: (name: string) =>
      Promise.resolve(ethers.isAddress(name) ? name : null),
  };
}

// Minimal ABIs
const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
];

const ERC20_ABI = [
  "function approve(address _spender, uint256 _value) returns (bool)",
];

// UniversalRouter ABI (minimal - just execute function)
const UNIVERSAL_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "bytes", name: "commands", type: "bytes" },
      { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "execute",
    outputs: [{ internalType: "bytes[]", name: "", type: "bytes[]" }],
    stateMutability: "payable",
    type: "function"
  }
];

// UniversalRouter command: V2_SWAP_EXACT_IN = 0x00
function encodeV2SwapExactIn(
  amountIn: string,
  amountOutMin: string,
  path: string[],
  recipient: string,
  payerIsUser: boolean = true
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ["uint256", "uint256", "address[]", "address", "bool"],
    [amountIn, amountOutMin, path, recipient, payerIsUser]
  );
}

export async function POST(request: NextRequest) {
  try {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      walletAddress,
    } = await request.json();

    if (!tokenIn || !tokenOut || !amountIn || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    console.log(`📥 Received swap request:`, {
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      slippageType: typeof slippage,
      walletAddress: walletAddress?.substring(0, 14) + "...",
    });

    // Validate and normalize all addresses
    let normalizedTokenIn: string;
    let normalizedTokenOut: string;
    let normalizedWalletAddress: string;
    
    try {
      normalizedTokenIn = validateAddress(tokenIn);
      normalizedTokenOut = validateAddress(tokenOut);
      normalizedWalletAddress = validateAddress(walletAddress);
    } catch (error) {
      return NextResponse.json(
        { error: `Invalid address: ${(error as Error).message}` },
        { status: 400 },
      );
    }

    // Build path with validated addresses
    const path = buildSwapPath(normalizedTokenIn, normalizedTokenOut);
    
    console.log(`Preparing swap: ${normalizedTokenIn.substring(0, 14)}... -> ${normalizedTokenOut.substring(0, 14)}... for wallet ${normalizedWalletAddress.substring(0, 14)}...`);
    console.log(`Swap path: [${path.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
    
    // Validate path addresses
    path.forEach((addr, index) => {
      try {
        const checksummed = validateAddress(addr);
        console.log(`  Path[${index}]: ${checksummed}`);
      } catch (e) {
        console.error(`  Path[${index}] INVALID:`, addr);
      }
    });

    // Convert amountIn to wei (assuming 18 decimals)
    const amountInWei = ethers.parseEther(amountIn);

    // Get amounts out with error handling and retry logic
    let amounts: bigint[] | undefined;
    const errors: string[] = [];
    
    for (let i = 0; i < BSC_RPC_URLS.length; i++) {
      const rpcUrl = BSC_RPC_URLS[i];
      try {
        console.log(`Attempting to call getAmountsOut on RPC ${i + 1}/${BSC_RPC_URLS.length}: ${rpcUrl.substring(0, 50)}...`);
        
        const rpcProvider = new ethers.JsonRpcProvider(rpcUrl, BSC_NETWORK, { staticNetwork: true });
        const rpcRouter = new ethers.Contract(
          PANCAKESWAP_ROUTER_ADDRESS,
          ROUTER_ABI,
          makeBscRunner(rpcProvider),
        );
        
        // Add timeout to prevent hanging
        const amountsPromise = rpcRouter.getAmountsOut(amountInWei, path);
        const result = await Promise.race([
          amountsPromise,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("RPC timeout after 10s")), 10000)
          )
        ]);
        
        amounts = result;
        console.log(`Successfully fetched amounts from RPC ${i + 1}: ${rpcUrl.substring(0, 50)}... Result: [${result.map((a: bigint) => a.toString()).join(", ")}]`);
        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${rpcUrl.substring(0, 50)}...: ${errorMsg}`);
        console.warn(`RPC ${i + 1}/${BSC_RPC_URLS.length} failed: ${errorMsg}`);
        
        // Add small delay before retrying (except on last attempt)
        if (i < BSC_RPC_URLS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    if (!amounts) {
      throw new Error(`All RPC endpoints failed. Errors: ${errors.join("; ")}`);
    }

    const amountOutWei = amounts![amounts!.length - 1];

    // Calculate minimum amount with slippage
    const slippagePercentage = parseFloat(slippage as string) || 0.5;
    console.log(`📊 Slippage calculation:`, {
      slippageInput: slippage,
      slippagePercentage,
      amountOutWei: amountOutWei.toString(),
      amountOutEther: ethers.formatEther(amountOutWei),
      calculation: `${amountOutWei.toString()} * (10000 - ${Math.round(slippagePercentage * 100)}) / 10000`,
    });
    const minimumAmountOutWei = (amountOutWei * BigInt(10000 - Math.round(slippagePercentage * 100))) / BigInt(10000);
    console.log(`  Result minimumAmountOut: ${ethers.formatEther(minimumAmountOutWei)}`);

    // Set deadline to 2 hours from now (very generous for testing)
    const deadline = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    console.log(`⏰ Deadline set to: ${deadline} (${new Date(deadline * 1000).toISOString()})`);

    // Determine which swap function to use based on input token
    const isBNBInput = normalizedTokenIn.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const isBNBOutput = normalizedTokenOut.toLowerCase() === WBNB_ADDRESS.toLowerCase();

    console.log(`🔄 Swap direction:`, {
      isBNBInput,
      isBNBOutput,
      normalizedTokenIn: normalizedTokenIn.substring(0, 14) + "...",
      normalizedTokenOut: normalizedTokenOut.substring(0, 14) + "...",
      WBNB_ADDRESS: WBNB_ADDRESS.substring(0, 14) + "...",
    });

    // We'll handle value (msg.value) differently for UniversalRouter
    // If input is BNB, we need to wrap it first, so the caller sends value
    const txValue = isBNBInput ? amountInWei.toString() : "0";

    console.log(`  minimumOut(Wei): ${minimumAmountOutWei.toString()}`);
    console.log(`  path: [${path.join(", ")}]`);
    console.log(`  recipient: ${normalizedWalletAddress}`);
    console.log(`  deadline: ${deadline}`);

    // ✅ Use UniversalRouter (like the official PancakeSwap does)
    console.log(`🔄 Using UniversalRouter for swap execution`);
    
    // Encode V2_SWAP_EXACT_IN command for UniversalRouter
    // Command: 0x00 (V2_SWAP_EXACT_IN)
    // Always use payerIsUser=true since the user will provide the tokens
    const swapInputData = encodeV2SwapExactIn(
      amountInWei.toString(),
      minimumAmountOutWei.toString(),
      path,
      normalizedWalletAddress,
      true // payerIsUser
    );

    // Create the commands and inputs for UniversalRouter.execute
    const commands = Uint8Array.from([0x00]); // V2_SWAP_EXACT_IN command
    const inputs = [swapInputData];

    // Encode the UniversalRouter.execute call
    const universalRouterIface = new ethers.Interface(UNIVERSAL_ROUTER_ABI);
    const swapData = universalRouterIface.encodeFunctionData("execute", [
      commands,
      inputs,
      deadline
    ]);

    console.log(`✓ Encoded UniversalRouter swap: ${swapData}`);
    console.log(`  Commands: [0x00 = V2_SWAP_EXACT_IN]`);
    console.log(`  SwapInput (encoded): ${swapInputData.substring(0, 100)}...`);

    // For non-BNB input, we need approval transaction first
    let approvalData = null;
    if (!isBNBInput) {
      const tokenIface = new ethers.Interface(ERC20_ABI);
      // Approve UniversalRouter to spend the tokens
      approvalData = tokenIface.encodeFunctionData("approve", [
        UNIVERSAL_ROUTER_ADDRESS,
        amountInWei.toString(),
      ]);
      console.log(`✓ Will request approval for ${UNIVERSAL_ROUTER_ADDRESS.substring(0, 14)}...`);
    }

    return NextResponse.json({
      swap: {
        to: UNIVERSAL_ROUTER_ADDRESS,
        data: swapData,
        value: txValue,
      },
      approval: approvalData ? {
        to: normalizedTokenIn,
        data: approvalData,
      } : null,
      details: {
        amountIn,
        amountOut: ethers.formatEther(amountOutWei),
        minimumAmountOut: ethers.formatEther(minimumAmountOutWei),
        path,
        deadline,
      },
    });
  } catch (error) {
    console.error("Error preparing swap transaction:", error);
    return NextResponse.json(
      { error: "Failed to prepare swap transaction", details: (error as Error).message },
      { status: 500 },
    );
  }
}

function buildSwapPath(tokenIn: string, tokenOut: string): string[] {
  const WBNB = WBNB_ADDRESS.toLowerCase();
  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();

  // Direct swap if one is WBNB
  if (normalizedIn === WBNB || normalizedOut === WBNB) {
    return [tokenIn, tokenOut];
  }

  // Route through WBNB for other pairs
  return [tokenIn, WBNB_ADDRESS, tokenOut];
}
