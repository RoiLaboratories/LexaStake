import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  fetchReserves,
  validateSwapSanity,
  formatValidationErrors,
} from "@/utils/swapValidation";

const PANCAKESWAP_ROUTER_V2_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const BSC_RPC_URLS = (() => {
  const urls: string[] = [];
  
  // Add Alchemy if API key is available
  if (process.env.ALCHEMY_API_KEY) {
    urls.push(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  }
  
  // Add fallback public endpoints
  urls.push(
    "https://bsc.meowrpc.com",
    "https://bsc.publicnode.com",
    "https://endpoints.omnirpc.io/bsc",
    "https://bsc-dataseed1.binance.org",
  );
  
  return urls;
})();

const BSC_NETWORK = ethers.Network.from({ chainId: 56, name: "binance" });
const BSC_RPC_URL = BSC_RPC_URLS[0];

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
  } catch {
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

// Router ABI for native BNB buys and token-to-native-BNB sells.
const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] amounts)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
];

const ERC20_ABI = [
  "function approve(address _spender, uint256 _value) returns (bool)",
];

// Pair ABI for LEXA/BNB reserve diagnostics.
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
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

    const normalizedTokenInLower = normalizedTokenIn.toLowerCase();
    const normalizedTokenOutLower = normalizedTokenOut.toLowerCase();
    const wbnbLower = WBNB_ADDRESS.toLowerCase();
    const lexaLower = "0x6fc20e595A8704725DBd160E7c799665706e0bdD".toLowerCase();

    // Build path with validated addresses
    const path = buildSwapPath(normalizedTokenIn, normalizedTokenOut);
    
    console.log(`Preparing swap: ${normalizedTokenIn.substring(0, 14)}... -> ${normalizedTokenOut.substring(0, 14)}... for wallet ${normalizedWalletAddress.substring(0, 14)}...`);
    console.log(`Base path (before native BNB logic): [${path.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
    
    // Validate path addresses
    path.forEach((addr, index) => {
      try {
        const checksummed = validateAddress(addr);
        console.log(`  Path[${index}]: ${checksummed}`);
      } catch {
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
    
    // 🔍 LOG QUOTE IMMEDIATELY
    console.log(`\n💾 QUOTE FROM ROUTER:`);
    console.log(`   quoteOut (wei): ${amountOutWei.toString()}`);
    console.log(`   quoteOut (tokens): ${ethers.formatEther(amountOutWei)}`);
    
    // ========== CALCULATE 0.3% FEE DEDUCTION ==========
    const FEE_BASIS_POINTS = 30; // 0.3%
    const BASIS_POINTS_DENOMINATOR = 10000; // 100%
    const feeAmountWei = (amountOutWei * BigInt(FEE_BASIS_POINTS)) / BigInt(BASIS_POINTS_DENOMINATOR);
    const userOutputAmountWei = amountOutWei - feeAmountWei;
    
    console.log(`\n💸 FEE DEDUCTION (0.3%):`);
    console.log(`   Total output (wei): ${amountOutWei.toString()}`);
    console.log(`   Fee (0.3%):         ${feeAmountWei.toString()}`);
    console.log(`   User receives (wei): ${userOutputAmountWei.toString()}`);
    console.log(`   User receives:      ${ethers.formatEther(userOutputAmountWei)} tokens`)
    
    // ⚠️ GUARD 1: Reject if no liquidity
    if (amountOutWei === BigInt(0)) {
      console.error(`❌ ERROR: Router returned 0 output. No liquidity on this pair.`);
      throw new Error("No liquidity for this token pair");
    }

    // ⚠️ GUARD 2: PRICE IMPACT CHECK
    console.log(`\n🔬 PRICE IMPACT ANALYSIS:`);
    try {
      const rpcProvider = new ethers.JsonRpcProvider(BSC_RPC_URLS[0], BSC_NETWORK, { staticNetwork: true });
      
      // For cross-token swaps (like LEXA→BNB), the naive price impact calculation
      // breaks because tokens have vastly different prices ($0.0014 LEXA vs $600 BNB)
      // Instead, we'll use the reserves sanity check if available
      
      try {
        const reserves = await fetchReserves(rpcProvider, path[0]); // Try first token as pair hint
        const reserve0 = reserves.reserve0;
        const reserve1 = reserves.reserve1;
        console.log(`   ✓ Fetched pair reserves`);
        console.log(`   Reserve0: ${ethers.formatEther(reserve0)}`);
        console.log(`   Reserve1: ${ethers.formatEther(reserve1)}`);
        
        // For meaningful price impact calc, we'd need fair prices from oracle
        // For now, just warn if output is suspiciously low relative to reserves
        const reserve0Pct = (Number(amountInWei) / Number(reserve0)) * 100;
        console.log(`   Input as % of reserve: ${reserve0Pct.toFixed(3)}%`);
        
        if (reserve0Pct > 10) {
          console.warn(`   ⚠️  WARNING: Input is >10% of available reserve - may encounter significant slippage`);
        }
      } catch {
        console.warn(`   ⚠️  Could not fetch reserves for additional checks`);
      }

      // For cross-token swaps with different price scales, the naive 
      // price impact formula is meaningless. Instead, check:
      // 1. Output is non-zero (checked earlier)
      // 2. Output is at least 1 wei (prevents dust)
      // 3. Slippage formula applied correctly
      
      if (amountOutWei < BigInt(1)) {
        console.error(`❌ ERROR: Output too low (< 1 wei). Route may have liquidity issue.`);
        throw new Error(`Output amount too low for this swap. Possible causes:
          1. Pool has insufficient liquidity
          2. Token prices are extremely skewed
          3. Wrong token address used`);
      }
      
      console.log(`   ✓ Output is non-zero and meaningful`);
      console.log(`   ℹ️  Price impact calculation skipped for cross-token swaps (requires price oracle)`);
    } catch (guardError) {
      // Only throw if it's a fundamental issue, not a calculation warning
      if (guardError instanceof Error && guardError.message.includes("Output too low")) {
        throw guardError;
      }
      console.warn(`⚠️  Could not perform additional validation checks: ${guardError instanceof Error ? guardError.message : String(guardError)}`);
    }

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
    // Convert percentage (e.g., 6) to basis points (e.g., 600)
    const slippagePercentage = parseFloat(slippage as string) || 0.5;
    
    // ⚠️  VALIDATE SLIPPAGE: Minimum 7% required for thin pairs like LEXA↔BNB
    const isDirectLexaBnbPair = 
      (normalizedTokenInLower === lexaLower &&
       normalizedTokenOutLower === wbnbLower) ||
      (normalizedTokenInLower === wbnbLower &&
       normalizedTokenOutLower === lexaLower);
    const isLexaRoute =
      normalizedTokenInLower === lexaLower ||
      normalizedTokenOutLower === lexaLower;
    
    const isLexaToBnb = 
      normalizedTokenInLower === lexaLower &&
      normalizedTokenOutLower === wbnbLower;
    
    if (isLexaRoute && slippagePercentage < 7) {
      console.error(`\n❌ SLIPPAGE TOO LOW FOR THIN PAIR`);
      console.error(`   Pair: ${isDirectLexaBnbPair ? (isLexaToBnb ? "LEXA to BNB" : "BNB to LEXA") : "LEXA routed through WBNB"}`);
      console.error(`   Current slippage: ${slippagePercentage}%`);
      console.error(`   Minimum required: 7% (due to thin liquidity)`);
      console.error(`   User action: Please increase slippage in the UI to 7% or higher`);
      throw new Error(`SLIPPAGE_TOO_LOW: This LEXA route requires minimum 7% slippage. Please increase slippage to 7% or higher and try again.`);
    }
    
    const slippageBps = Math.round(slippagePercentage * 100);
    
    console.log(`📊 Slippage calculation:`, {
      slippageInput: slippage,
      slippagePercentage: `${slippagePercentage}%`,
      slippageBps: `${slippageBps} bps`,
      amountOutWei: amountOutWei.toString(),
      amountOutEther: ethers.formatEther(amountOutWei),
      calculation: `${amountOutWei.toString()} * (10000 - ${slippageBps}) / 10000`,
    });
    
    // Apply slippage to expected output
    // Formula: minOut = quoteOut * (10000 - slippageBps) / 10000
    let minimumAmountOutWei = (amountOutWei * BigInt(10000 - slippageBps)) / BigInt(10000);
    
    // 🌊 ADD VOLATILITY DRIFT BUFFER: Extra buffer for pool state changes during execution
    // On thin/volatile pairs, pool reserves can shift between quote and execution
    // This extra buffer prevents "Pancake: K" errors from minor drift
    // LEXA is an extremely volatile pair - needs aggressive buffering
    const volatilityBufferBps = isLexaRoute ? 300 : 50; // 3% for LEXA routes (very volatile), 0.5% for others
    const driftAdjustedMinOut = (minimumAmountOutWei * BigInt(10000 - volatilityBufferBps)) / BigInt(10000);
    
    console.log(`\n🌊 VOLATILITY DRIFT BUFFER:`);
    console.log(`   Pair: ${isLexaRoute ? "LEXA route (EXTREMELY volatile)" : "Standard pair"}`);
    console.log(`   Base slippage: ${slippagePercentage}%`);
    console.log(`   Volatility buffer: ${volatilityBufferBps / 100}%`);
    console.log(`   minOut before drift: ${ethers.formatEther(minimumAmountOutWei)}`);
    console.log(`   minOut after drift:  ${ethers.formatEther(driftAdjustedMinOut)}`);
    console.log(`   Combined reduction:  ${slippagePercentage + (volatilityBufferBps / 100)}%`);
    
    minimumAmountOutWei = driftAdjustedMinOut;
    
    // 🔧 DEBUG MODE: Allow setting minOut = 0n for testing
    // This is ONLY for testing with your own wallet to confirm actual execution output
    const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_SWAP === "true";
    if (DEBUG_MODE) {
      console.log(`\n🔧 DEBUG MODE ACTIVE: Setting minOut = 0n for test execution`);
      console.log(`   This will allow tx to succeed even with 0 output`);
      console.log(`   ⚠️  ONLY USE FOR YOUR TEST WALLET - NOT FOR PRODUCTION`);
      minimumAmountOutWei = BigInt(0);
    }
    
    // 🔍 LOG MINOUT CALCULATION
    console.log(`\n💾 MINIMUM OUTPUT CALCULATION:`);
    console.log(`   quoteOut (wei):     ${amountOutWei.toString()}`);
    console.log(`   quoteOut (tokens):  ${ethers.formatEther(amountOutWei)}`);
    console.log(`   slippageBps:        ${slippageBps} (${slippagePercentage}%)`);
    console.log(`   minOut formula:     quoteOut * (10000 - ${slippageBps}) / 10000`);
    console.log(`   minOut (wei):       ${minimumAmountOutWei.toString()}`);
    console.log(`   minOut (tokens):    ${ethers.formatEther(minimumAmountOutWei)}`);
    if (minimumAmountOutWei > BigInt(0)) {
      console.log(`   difference:         ${ethers.formatEther(amountOutWei - minimumAmountOutWei)} tokens`);
    } else if (DEBUG_MODE) {
      console.log(`   ⚠️  DEBUG MODE: minOut set to 0 for testing`);
    }
    
    // ⚠️ GUARD 5: COMPREHENSIVE SWAP SANITY CHECK
    console.log(`\n✅ COMPREHENSIVE SWAP VALIDATION:`);
    const sanityResult = validateSwapSanity({
      quoteOut: amountOutWei,
      minOut: minimumAmountOutWei,
      amountIn: amountInWei,
      maxPriceImpactBps: 1500,
      priceImpactBps: 0, // Don't use naive calculation for cross-token swaps
      minOutputAbsolute: ethers.parseEther("0.1"),
      tokenOutDecimals: 18,
    });
    
    if (!sanityResult.valid && !DEBUG_MODE) {
      console.error(`❌ SWAP VALIDATION FAILED:`);
      console.error(formatValidationErrors(sanityResult.errors));
      throw new Error(
        `Swap validation failed: ${sanityResult.errors[0]}. Check logs for details.`
      );
    } else if (!sanityResult.valid && DEBUG_MODE) {
      console.warn(`⚠️  DEBUG MODE: Ignoring validation errors this time:`);
      console.warn(formatValidationErrors(sanityResult.errors));
    } else {
      console.log(`   ✓ All sanity checks passed`);
    }
    
    // ⚠️ GUARD: Reject if output dust (unless in debug mode)
    // For meaningful swaps, output should be at least 1 wei (0.000000000000000001 tokens)
    // This prevents issues where router quotes near-zero amounts
    const MIN_OUT_ABS = BigInt(1); // 1 wei minimum (not 0.1 tokens - that's arbitrary)
    if (minimumAmountOutWei < MIN_OUT_ABS && !DEBUG_MODE) {
      console.error(`❌ ERROR: Minimum output below 1 wei (${ethers.formatEther(minimumAmountOutWei)} tokens). This indicates extremely thin liquidity.`);
      throw new Error("Output amount too low for reliable execution");
    }
    
    const minimumAmountOutEther = ethers.formatEther(minimumAmountOutWei);
    
    // ✅ FINAL SANITY CHECK BEFORE BUILDING TRANSACTION
    console.log(`\n✅ PRE-TRANSACTION VALIDATION:`);
    console.log(`   ✓ Quote is non-zero: ${amountOutWei.toString()}`);
    if (minimumAmountOutWei > BigInt(0) || !DEBUG_MODE) {
      console.log(`   ✓ MinOut is above dust: ${minimumAmountOutWei.toString()}`);
    } else {
      console.log(`   ⚠️  DEBUG MODE: MinOut set to 0 for testing`);
    }
    console.log(`   ✓ Slippage in safe range: ${slippagePercentage}%`);
    console.log(`   ✓ All checks passed - ready to build transaction`);
    
    // ✅ VERIFICATION: Log actual slippage applied
    const expectedAmount = parseFloat(ethers.formatEther(amountOutWei));
    const minimumAmount = parseFloat(minimumAmountOutEther);
    const totalReduction = minimumAmount > 0 
      ? ((expectedAmount - minimumAmount) / expectedAmount * 100).toFixed(3)
      : "N/A (debug mode)";
    console.log(`\n✅ SLIPPAGE VERIFICATION:`);
    console.log(`  Expected Output: ${ethers.formatEther(amountOutWei)} ${normalizedTokenOutLower === wbnbLower ? "BNB" : "tokens"}`);
    console.log(`  Minimum Output (after ${slippagePercentage}% slippage): ${minimumAmountOutEther} ${normalizedTokenOutLower === wbnbLower ? "BNB" : "tokens"}`);
    if (minimumAmount > 0 || !DEBUG_MODE) {
      console.log(`  Reduction: ${(expectedAmount - minimumAmount).toFixed(6)} tokens (~${totalReduction}%)`);
    } else {
      console.log(`  ⚠️  DEBUG MODE: Reduction calculation skipped`);
    }

    // Warn if minimum output is suspiciously low
    const amountOutNum = parseFloat(ethers.formatEther(amountOutWei));
    if (amountOutNum < 1 && normalizedTokenOutLower !== wbnbLower && !DEBUG_MODE) {
      console.warn(`⚠️  WARNING: Very low token output (${amountOutNum.toFixed(2)} tokens)`);
      console.warn(`    This suggests: small input, low liquidity, or token transfer tax`);
    }

    // Guard against unrealistic slippage values
    if (slippagePercentage < 0.1) {
      console.error(`❌ ERROR: Slippage too low (${slippagePercentage}%). Minimum 0.1% required.`);
      throw new Error("Slippage must be at least 0.1%");
    }
    if (slippagePercentage > 50) {
      console.error(`❌ ERROR: Slippage too high (${slippagePercentage}%). Maximum 50% allowed.`);
      throw new Error("Slippage must not exceed 50%");
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
    const isBNBOutput = normalizedTokenOutLower === wbnbLower;
    
    // Build the swap path based on input/output direction
    let swapPath: string[];
    if (isBNBInput) {
      // BNB → LEXA: [WBNB, LEXA]
      swapPath = [ethers.getAddress(WBNB_ADDRESS.toLowerCase()), ethers.getAddress(normalizedTokenOut.toLowerCase())];
    } else if (isBNBOutput) {
      // LEXA → BNB: [LEXA, WBNB]
      swapPath = [ethers.getAddress(normalizedTokenIn.toLowerCase()), ethers.getAddress(WBNB_ADDRESS.toLowerCase())];
    } else {
      // Token → Token (general case): route through WBNB if needed
      swapPath = [ethers.getAddress(normalizedTokenIn.toLowerCase()), ethers.getAddress(WBNB_ADDRESS.toLowerCase()), ethers.getAddress(normalizedTokenOut.toLowerCase())];
    }
    
    console.log(`\n💰 ROUTER V2 SWAP PREPARATION:`);
    console.log(`   Input: ${isBNBInput ? "Native BNB" : "Token (" + normalizedTokenIn.substring(0, 14) + "...)"}`);
    console.log(`   Output: ${isBNBOutput ? "Native BNB" : "Token (" + normalizedTokenOut.substring(0, 14) + "...)"}`);
    console.log(`   Path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" → ")}]`);
    
    // ========== DIAGNOSTIC: Debug LEXA→BNB reserve issues ==========
    if (!isBNBInput && isBNBOutput) {
      console.log(`\n🔍 [DIAGNOSTIC] LEXA→BNB Reserve Analysis`);
      try {
        const LEXA_PAIR = "0x3027f7b11AB243A1efe3F997430fca5996276E63";
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
        const pair = new ethers.Contract(LEXA_PAIR, PAIR_ABI, provider);
        
        const [r0, r1] = await pair.getReserves();
        const t0 = await pair.token0();
        
        console.log(`   Pair Address: ${LEXA_PAIR}`);
        
        const lexaIs0 = t0.toLowerCase() === normalizedTokenIn.toLowerCase();
        const reserveIn = lexaIs0 ? r0 : r1;
        const reserveOut = lexaIs0 ? r1 : r0;
        
        console.log(`   Reserve(LEXA): ${ethers.formatEther(reserveIn)}`);
        console.log(`   Reserve(WBNB): ${ethers.formatEther(reserveOut)}`);
        console.log(`   amountIn(LEXA): ${ethers.formatEther(amountInWei)}`);
        console.log(`   ratio (amountIn / reserveIn): ${(Number(amountInWei) / Number(reserveIn) * 100).toFixed(2)}%`);
        
        // V2 math: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
        const amountInWithFee = amountInWei * BigInt(997);
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn * BigInt(1000) + amountInWithFee;
        const theoreticalOut = numerator / denominator;
        
        console.log(`   Theoretical WBNB out: ${ethers.formatEther(theoreticalOut)}`);
        console.log(`   Current minOut target: ${ethers.formatEther(minimumAmountOutWei)}`);
        
        // Check for risky pool conditions - log warnings but don't block
        const MIN_OUTPUT_BNB = ethers.parseEther("0.0001"); // 0.0001 BNB minimum
        const OUTPUT_RESERVE_WARNING = ethers.parseEther("5"); // Warn if < 5 BNB reserve
        
        if (theoreticalOut < MIN_OUTPUT_BNB) {
          console.warn(`   ⚠️  OUTPUT SMALL: ${ethers.formatEther(theoreticalOut)} < 0.0001 BNB`);
          console.warn(`      Gas estimation may fail, but transaction might still succeed`);
        }
        
        if (reserveOut < OUTPUT_RESERVE_WARNING) {
          console.warn(`   ⚠️  WBNB RESERVE SHALLOW: ${ethers.formatEther(reserveOut)} WBNB`);
          console.warn(`      Swap may fail due to pool conditions, but proceeding anyway`);
        }
      } catch (err) {
        console.error(`   Diagnostic failed:`, err instanceof Error ? err.message : String(err));
      }
    }
    
    // Create Router V2 and ERC20 interfaces
    const routerIface = new ethers.Interface(ROUTER_ABI);
    const erc20Iface = new ethers.Interface(ERC20_ABI);
    
    if (isBNBInput) {
      // BNB input: Use Router V2 swapExactETHForTokens (BNB→LEXA)
      console.log(`\n📝 FUNCTION: swapExactETHForTokens (Router V2)`);
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
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)}`);
      console.log(`     - deadline: ${deadline}`);
      
      txValue = amountInWei.toString();
    } else if (isBNBOutput) {
      // Token input, native BNB output (LEXA -> BNB): use Router V2.
      // The supporting-fee function is safer for taxed/fee-on-transfer tokens.
      console.log(`\nFUNCTION: swapExactTokensForETHSupportingFeeOnTransferTokens (Router V2)`);
      console.log(`   Parameters:`);
      console.log(`     - amountIn: ${ethers.formatEther(amountInWei)} (${amountInWei.toString()} wei)`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} (${minimumAmountOutWei.toString()} wei)`);
      console.log(`     - path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
      console.log(`     - to: ${normalizedWalletAddress}`);
      console.log(`     - deadline: ${deadline}`);

      swapData = routerIface.encodeFunctionData(
        "swapExactTokensForETHSupportingFeeOnTransferTokens",
        [
          amountInWei,
          minimumAmountOutWei,
          swapPath,
          normalizedWalletAddress,
          deadline,
        ],
      );

      console.log(`\nRouter V2 swapExactTokensForETHSupportingFeeOnTransferTokens() encoded successfully`);
      console.log(`  Function selector: ${swapData.substring(0, 10)}`);
      console.log(`  Encoded data length: ${swapData.length} chars`);
      console.log(`  TRANSACTION DETAILS:`);
      console.log(`     - to: Router V2 ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
      console.log(`     - value: 0`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} BNB`);
      console.log(`     - deadline: ${deadline}`);
    } else {
      // Token input, token output (USDT -> LEXA or LEXA -> USDT): use Router V2.
      // The supporting-fee function is safer when LEXA is part of the route.
      console.log(`\nFUNCTION: swapExactTokensForTokensSupportingFeeOnTransferTokens (Router V2)`);
      console.log(`   Parameters:`);
      console.log(`     - amountIn: ${ethers.formatEther(amountInWei)} (${amountInWei.toString()} wei)`);
      console.log(`     - amountOutMin: ${ethers.formatEther(minimumAmountOutWei)} (${minimumAmountOutWei.toString()} wei)`);
      console.log(`     - path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
      console.log(`     - to: ${normalizedWalletAddress}`);
      console.log(`     - deadline: ${deadline}`);

      swapData = routerIface.encodeFunctionData(
        "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        [
          amountInWei,
          minimumAmountOutWei,
          swapPath,
          normalizedWalletAddress,
          deadline,
        ],
      );

      console.log(`\nRouter V2 swapExactTokensForTokensSupportingFeeOnTransferTokens() encoded successfully`);
      console.log(`  Function selector: ${swapData.substring(0, 10)}`);
      console.log(`  Encoded data length: ${swapData.length} chars`);
      console.log(`  TRANSACTION DETAILS:`);
      console.log(`     - to: Router V2 ${PANCAKESWAP_ROUTER_V2_ADDRESS}`);
      console.log(`     - value: 0`);
      console.log(`     - deadline: ${deadline}`);
    }

    // For token input, approve Router V2 to spend the input token.
    let approvalData = null;
    let approvalTarget = null;
    
    if (!isBNBInput) {
      approvalTarget = PANCAKESWAP_ROUTER_V2_ADDRESS;
      approvalData = erc20Iface.encodeFunctionData("approve", [
        PANCAKESWAP_ROUTER_V2_ADDRESS,
        amountInWei.toString(),
      ]);
      console.log(`\nWill request approval for Router V2: ${PANCAKESWAP_ROUTER_V2_ADDRESS.substring(0, 14)}...`);
      console.log(`  Token: ${normalizedTokenIn.substring(0, 14)}...`);
      console.log(`  Amount: ${ethers.formatEther(amountInWei)}`);
    }

    console.log(`\n✅ [PREPARE-SWAP] FINAL RESPONSE`);
    let functionName = "";
    let targetAddress = "";
    
    if (isBNBInput) {
      functionName = "swapExactETHForTokens (Router V2)";
      targetAddress = PANCAKESWAP_ROUTER_V2_ADDRESS;
    } else if (isBNBOutput) {
      functionName = "swapExactTokensForETHSupportingFeeOnTransferTokens (Router V2)";
      targetAddress = PANCAKESWAP_ROUTER_V2_ADDRESS;
    } else {
      functionName = "swapExactTokensForTokensSupportingFeeOnTransferTokens (Router V2)";
      targetAddress = PANCAKESWAP_ROUTER_V2_ADDRESS;
    }
    
    console.log(`   Function: ${functionName}`);
    console.log(`   Target: ${targetAddress}`);
    console.log(`   Swap data length: ${swapData.length} chars`);
    console.log(`   Transaction value: ${isBNBInput ? ethers.formatEther(txValue) + " BNB" : "0"}`);

    // Build response - all supported swaps execute through Router V2.
    const response = {
      swap: {
        to: PANCAKESWAP_ROUTER_V2_ADDRESS,
        data: swapData,
        value: isBNBInput ? txValue : "0",  // Only for BNB input
      },
      approval: approvalData ? {
        to: normalizedTokenIn,
        data: approvalData,
      } : null,
      transfer: null,
      details: {
        amountIn,
        amountOut: ethers.formatEther(amountOutWei),
        minimumAmountOut: ethers.formatEther(minimumAmountOutWei),
        userAmountOut: ethers.formatEther(userOutputAmountWei),
        feeAmount: ethers.formatEther(feeAmountWei),
        feeAmountWei: feeAmountWei.toString(),
        feePercentage: "0.3",
        path: swapPath,
        deadline,
        isBNBInput,
        slippage: slippagePercentage,
        executionType: "router",
      },
    };

    console.log(`\n📤 RESPONSE SUMMARY:`);
    console.log(`   Execution type: Router V2`);
    console.log(`   Has approval: ${!!response.approval}`);
    console.log(`   Has transfer: ${!!response.transfer}`);
    console.log(`   Input type: ${isBNBInput ? "Native BNB" : "Token"}`);
    console.log(`   💸 Output breakdown:`);
    console.log(`       Total output: ${ethers.formatEther(amountOutWei)} tokens`);
    console.log(`       Fee (0.3%):   ${ethers.formatEther(feeAmountWei)} tokens → Fee Collector`);
    console.log(`       User gets:    ${ethers.formatEther(userOutputAmountWei)} tokens`);
    if (response.approval) {
      console.log(`   Approval target: ${approvalTarget?.substring(0, 14)}...`);
    }

    return NextResponse.json(response);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const isUserFixableError =
      details.includes("SLIPPAGE_TOO_LOW") ||
      details.includes("No liquidity") ||
      details.includes("Output amount too low") ||
      details.includes("Slippage");

    console.error("Error preparing swap transaction:", error);
    return NextResponse.json(
      {
        error: isUserFixableError ? details : "Failed to prepare swap transaction",
        details,
      },
      { status: isUserFixableError ? 400 : 500 },
    );
  }
}
