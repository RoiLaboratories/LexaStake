import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const PANCAKESWAP_ROUTER_V2_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";  // For quote fetching only
const PANCAKESWAP_UNIVERSAL_ROUTER_ADDRESS = "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB";  // For swap execution
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

/** Build swap path - can route through WBNB if needed */
function buildSwapPath(tokenIn: string, tokenOut: string): string[] {
  const in_ = tokenIn.toLowerCase();
  const out = tokenOut.toLowerCase();
  const wbnb = WBNB_ADDRESS.toLowerCase();

  // Direct path if one of them is WBNB
  if (in_ === wbnb || out === wbnb) {
    return [tokenIn, tokenOut];
  }

  // Route through WBNB
  return [tokenIn, WBNB_ADDRESS, tokenOut];
}

const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] amounts)",
];

// Universal Router ABI - no longer used, reverting to Router V2
// const UNIVERSAL_ROUTER_ABI = [
//   "function execute(bytes commands, bytes[] inputs) payable",
//   "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
// ];

// Command codes for Universal Router - no longer used
// const COMMAND_CODES = {
//   WRAP_ETH: 0x0b,
//   SWAP_WITH_EXACT_INPUT: 0x08,
// };

const ERC20_ABI = [
  "function approve(address _spender, uint256 _value) returns (bool)",
];

export async function POST(request: NextRequest) {
  try {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      walletAddress,
      fromNativeBNB,  // Flag to indicate if swapping from native BNB (not WBNB token)
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
      slippageAsNumber: parseFloat(slippage as string),
      walletAddress: walletAddress?.substring(0, 14) + "...",
      fromNativeBNB,
    });
    
    // ✅ VALIDATE TOKEN ADDRESSES
    console.log(`\n🔍 ADDRESS VALIDATION:`);
    console.log(`  Input token:  ${tokenIn}`);
    console.log(`  Output token: ${tokenOut}`);
    console.log(`  WBNB address: ${WBNB_ADDRESS}`);
    console.log(`  From Native BNB: ${fromNativeBNB}`);
    
    const isInputWBNB = tokenIn.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const isOutputWBNB = tokenOut.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    
    if (fromNativeBNB) {
      console.log(`  ✓ Input will be NATIVE BNB (router will wrap to WBNB internally)`);
    } else if (isInputWBNB) {
      console.log(`  ✓ Input is WBNB token: ${tokenIn}`);
    } else {
      console.log(`  ✓ Input is custom token: ${tokenIn}`);
    }
    
    if (isOutputWBNB) {
      console.log(`  ✓ Output is WBNB (native BNB chain)`);
    } else {
      console.log(`  ✓ Output is custom token: ${tokenOut}`);
    }

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
    let path = buildSwapPath(normalizedTokenIn, normalizedTokenOut);
    
    console.log(`Preparing swap: ${normalizedTokenIn.substring(0, 14)}... -> ${normalizedTokenOut.substring(0, 14)}... for wallet ${normalizedWalletAddress.substring(0, 14)}...`);
    console.log(`Base path (before native BNB logic): [${path.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
    
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
          PANCAKESWAP_ROUTER_V2_ADDRESS,
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

    // SANITY CHECK: Verify prices aren't suspiciously extreme
    const amountOutEth = parseFloat(ethers.formatEther(amountOutWei));
    const priceRatio = amountOutEth / parseFloat(amountIn);
    
    console.log(`\n🔬 PRICE SANITY CHECK:`);
    console.log(`   Input: ${amountIn} BNB`);
    console.log(`   Output: ${amountOutEth.toFixed(6)} tokens`);
    console.log(`   Price ratio: 1 BNB = ${priceRatio.toFixed(2)} LEXA`);
    
    if (priceRatio > 100) {
      console.warn(`\n⚠️  WARNING: Price ratio seems EXTREME (${priceRatio.toFixed(2)})`);
      console.warn(`   This could indicate:`);
      console.warn(`   1. WRONG TOKEN ADDRESS - LEXA address may be incorrect`);
      console.warn(`   2. Token with many decimals - check if decimals are 18`);
      console.warn(`   3. Fake/non-existent pair - verify pair exists on PancakeSwap`);
      console.warn(`   Address used: ${normalizedTokenOut}`);
    } else if (priceRatio < 0.001) {
      console.warn(`\n⚠️  WARNING: Price ratio seems TOO LOW (${priceRatio.toFixed(6)})`);
      console.warn(`   Token may be extremely expensive or address is wrong`);
    }

    // Calculate minimum amount with slippage
    // 6% slippage accounts for LEXA's 5% transfer tax + transaction volatility
    const slippagePercentage = parseFloat(slippage as string) || 0.5;
    console.log(`📊 Slippage calculation:`, {
      slippageInput: slippage,
      slippagePercentage,
      amountOutWei: amountOutWei.toString(),
      amountOutEther: ethers.formatEther(amountOutWei),
      calculation: `${amountOutWei.toString()} * (10000 - ${Math.round(slippagePercentage * 100)}) / 10000`,
    });
    
    // Apply slippage to expected output
    // Slippage naturally accounts for price volatility, token transfer tax, and fees
    const minimumAmountOutWei = (amountOutWei * BigInt(10000 - Math.round(slippagePercentage * 100))) / BigInt(10000);
    
    const minimumAmountOutEther = ethers.formatEther(minimumAmountOutWei);
    
    // ✅ VERIFICATION: Log actual slippage applied
    const expectedAmount = parseFloat(ethers.formatEther(amountOutWei));
    const minimumAmount = parseFloat(minimumAmountOutEther);
    const totalReduction = ((expectedAmount - minimumAmount) / expectedAmount * 100).toFixed(3);
    console.log(`\n✅ SLIPPAGE VERIFICATION:`);
    console.log(`  Expected Output: ${ethers.formatEther(amountOutWei)} ${normalizedTokenOut === WBNB_ADDRESS.toLowerCase() ? "BNB" : "tokens"}`);
    console.log(`  Minimum Output (after ${slippagePercentage}% slippage): ${minimumAmountOutEther} ${normalizedTokenOut === WBNB_ADDRESS.toLowerCase() ? "BNB" : "tokens"}`);
    console.log(`  Reduction: ${(expectedAmount - minimumAmount).toFixed(6)} tokens (~${totalReduction}%)`);

    // Warn if minimum output is suspiciously low
    const amountOutNum = parseFloat(ethers.formatEther(amountOutWei));
    const minimumOutNum = parseFloat(minimumAmountOutEther);
    if (amountOutNum < 1 && normalizedTokenOut !== WBNB_ADDRESS.toLowerCase()) {
      console.warn(`⚠️  WARNING: Very low token output (${amountOutNum.toFixed(2)} tokens)`);
      console.warn(`    This suggests: small input, low liquidity, or token transfer tax`);
    }

    // Set deadline to 2 hours from now (very generous for testing)
    const deadline = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    console.log(`⏰ Deadline set to: ${deadline} (${new Date(deadline * 1000).toISOString()})`);

    // ✅ Use PancakeSwap Router V2 for swap execution
    console.log(`🔄 Using Router V2 for swap execution`);
    console.log(`   Router V2 Address: ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
    
    let swapData: string;
    let txValue = "0";

    const isBNBInput = fromNativeBNB === true;

    // Build the swap path (always starts with WBNB for this swap)
    const swapPath = [ethers.getAddress(WBNB_ADDRESS.toLowerCase()), ethers.getAddress(normalizedTokenOut.toLowerCase())];
    
    console.log(`\n💰 ROUTER V2 SWAP PREPARATION:`);
    console.log(`   Input: ${isBNBInput ? "Native BNB" : "Token"}`);
    console.log(`   Output: LEXA (${normalizedTokenOut.substring(0, 14)}...)`);
    console.log(`   Path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" → ")}]`);
    
    // Create Router V2 interface
    const routerIface = new ethers.Interface(ROUTER_ABI);
    
    if (isBNBInput) {
      // Use swapExactETHForTokens for native BNB input
      console.log(`\n📝 FUNCTION: swapExactETHForTokens`);
      console.log(`   Parameters:`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} (${minimumAmountOutWei.toString()} wei)`);
      console.log(`     - path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" → ")}]`);
      console.log(`     - to: ${normalizedWalletAddress}`);
      console.log(`     - deadline: ${deadline}`);
      
      swapData = routerIface.encodeFunctionData("swapExactETHForTokens", [
        minimumAmountOutWei,
        swapPath,
        normalizedWalletAddress,
        deadline,
      ]);
      
      console.log(`\n✓ Router V2 swapExactETHForTokens() encoded successfully`);
      console.log(`  Function selector: ${swapData.substring(0, 10)}`);
      console.log(`  Encoded data length: ${swapData.length} chars`);
      console.log(`  💾 TRANSACTION DETAILS:`);
      console.log(`     - to: Router V2 ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
      console.log(`     - value: ${ethers.formatEther(amountInWei)} BNB (${amountInWei.toString()} wei)`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} LEXA`);
      console.log(`     - deadline: ${deadline}`);
      
      txValue = amountInWei.toString();
    } else {
      // Use swapExactTokensForTokens for token input
      console.log(`\n📝 FUNCTION: swapExactTokensForTokens`);
      console.log(`   Parameters:`);
      console.log(`     - amountIn: ${ethers.formatEther(amountInWei)} (${amountInWei.toString()} wei)`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} (${minimumAmountOutWei.toString()} wei)`);
      console.log(`     - path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" → ")}]`);
      console.log(`     - to: ${normalizedWalletAddress}`);
      console.log(`     - deadline: ${deadline}`);
      
      swapData = routerIface.encodeFunctionData("swapExactTokensForTokens", [
        amountInWei,
        minimumAmountOutWei,
        swapPath,
        normalizedWalletAddress,
        deadline,
      ]);
      
      console.log(`\n✓ Router V2 swapExactTokensForTokens() encoded successfully`);
      console.log(`  Function selector: ${swapData.substring(0, 10)}`);
      console.log(`  Encoded data length: ${swapData.length} chars`);
      console.log(`  💾 TRANSACTION DETAILS:`);
      console.log(`     - to: Router V2 ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
      console.log(`     - amountIn: ${ethers.formatEther(amountInWei)} tokens`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} LEXA`);
      console.log(`     - deadline: ${deadline}`);
    }

    // For token input, we need approval for Router V2
    let approvalData = null;
    if (!isBNBInput) {
      const tokenIface = new ethers.Interface(ERC20_ABI);
      // Approve Router V2 to spend the tokens
      approvalData = tokenIface.encodeFunctionData("approve", [
        PANCAKESWAP_ROUTER_V2_ADDRESS,
        amountInWei.toString(),
      ]);
      console.log(`\n✓ Will request approval for Router V2: ${PANCAKESWAP_ROUTER_V2_ADDRESS.substring(0, 14)}...`);
    }

    console.log(`\n✅ [PREPARE-SWAP] FINAL RESPONSE (ROUTER V2)`);
    console.log(`   Router: ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
    console.log(`   Function: ${isBNBInput ? "swapExactETHForTokens" : "swapExactTokensForTokens"}`);
    console.log(`   Swap data length: ${swapData.length} chars`);
    console.log(`   Transaction value: ${isBNBInput ? ethers.formatEther(txValue) + " BNB" : "0"}`);

    // Build response using Router V2
    const response: any = {
      swap: {
        to: PANCAKESWAP_ROUTER_V2_ADDRESS,
        data: swapData,
        value: isBNBInput ? txValue : "0",  // Only for BNB input
      },
      approval: approvalData ? {
        to: normalizedTokenIn,
        data: approvalData,
      } : null,
      details: {
        amountIn,
        amountOut: ethers.formatEther(amountOutWei),
        minimumAmountOut: ethers.formatEther(minimumAmountOutWei),
        path: swapPath,
        deadline,
        isBNBInput,
        slippage: slippagePercentage,
      },
    };

    console.log(`\n📤 RESPONSE SUMMARY:`);
    console.log(`   Router used: Universal Router`);
    console.log(`   Has approval: ${!!response.approval}`);
    console.log(`   Input type: ${isBNBInput ? "Native BNB" : "Token"}`);
    if (response.approval) {
      console.log(`   Approval required: YES`);
      console.log(`   Approval target (token): ${normalizedTokenIn.substring(0, 14)}...`);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error preparing swap transaction:", error);
    return NextResponse.json(
      { error: "Failed to prepare swap transaction", details: (error as Error).message },
      { status: 500 },
    );
  }
}
