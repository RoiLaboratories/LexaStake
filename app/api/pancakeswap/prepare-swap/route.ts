import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const PANCAKESWAP_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
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

// Minimal ABIs for Router V2
const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactBNBForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] amounts)",
  "function swapExactTokensForBNB(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
];

const ERC20_ABI = [
  "function approve(address _spender, uint256 _value) returns (bool)",
];

const WBNB_ABI = [
  "function deposit() payable",
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
    const slippagePercentage = parseFloat(slippage as string) || 0.5;
    console.log(`📊 Slippage calculation:`, {
      slippageInput: slippage,
      slippagePercentage,
      amountOutWei: amountOutWei.toString(),
      amountOutEther: ethers.formatEther(amountOutWei),
      calculation: `${amountOutWei.toString()} * (10000 - ${Math.round(slippagePercentage * 100)}) / 10000`,
    });
    const minimumAmountOutWei = (amountOutWei * BigInt(10000 - Math.round(slippagePercentage * 100))) / BigInt(10000);
    const minimumAmountOutEther = ethers.formatEther(minimumAmountOutWei);
    console.log(`  Expected Output: ${ethers.formatEther(amountOutWei)} ${normalizedTokenOut === WBNB_ADDRESS.toLowerCase() ? "BNB" : "tokens"}`);
    console.log(`  Minimum Output (after slippage ${slippagePercentage}%): ${minimumAmountOutEther} ${normalizedTokenOut === WBNB_ADDRESS.toLowerCase() ? "BNB" : "tokens"}`);
    console.log(`  Slippage adjustment: ${(parseFloat(ethers.formatEther(amountOutWei)) - parseFloat(minimumAmountOutEther)).toFixed(6)} ${normalizedTokenOut === WBNB_ADDRESS.toLowerCase() ? "BNB" : "tokens"}`);

    // Warn if minimum output is suspiciously low
    const amountOutNum = parseFloat(ethers.formatEther(amountOutWei));
    const minimumOutNum = parseFloat(minimumAmountOutEther);
    if (amountOutNum < 1 && normalizedTokenOut !== WBNB_ADDRESS.toLowerCase()) {
      console.warn(`⚠️  WARNING: Very low token output (${amountOutNum.toFixed(2)} tokens)`);
      console.warn(`    This suggests: small input, low liquidity, or high token tax`);
    }

    // Set deadline to 2 hours from now (very generous for testing)
    const deadline = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    console.log(`⏰ Deadline set to: ${deadline} (${new Date(deadline * 1000).toISOString()})`);

    // ✅ Use PancakeSwap Router V2 for simple, direct swaps
    console.log(`🔄 Using Router V2 for swap execution`);
    
    const routerIface = new ethers.Interface(ROUTER_ABI);

    let swapData: string;
    let txValue = "0";

    // Determine which swap function to use based on input/output tokens
    // ⭐ CRITICAL: Check if input is native BNB (not WBNB token)
    // When user selects "BNB", we use native BNB → requires swapExactBNBForTokens
    // When user selects "WBNB" token, we use token → requires approval + swapExactTokensFor...
    const isBNBInput = fromNativeBNB === true;  // Explicitly use native BNB if flag is set
    const isBNBOutput = normalizedTokenOut.toLowerCase() === WBNB_ADDRESS.toLowerCase();

    console.log(`🔄 Swap direction:`, {
      isBNBInput,
      isBNBOutput,
      inputToken: normalizedTokenIn,
      outputToken: normalizedTokenOut,
      wbnbAddress: WBNB_ADDRESS.toLowerCase(),
      fromNativeBNB,
    });

    // Build the correct path for the swap
    let swapPath: string[];
    if (isBNBInput) {
      // Native BNB input: path must start with WBNB (router will wrap BNB → WBNB internally)
      console.log(`\n💰 NATIVE BNB INPUT PATH:`);
      console.log(`   User sends: Native BNB`);
      console.log(`   Router wraps: BNB → WBNB (internally via deposit)`);
      console.log(`   Path: [WBNB, ${normalizedTokenOut.substring(0, 14)}...]`);
      swapPath = [ethers.getAddress(WBNB_ADDRESS.toLowerCase()), ethers.getAddress(normalizedTokenOut.toLowerCase())];
    } else if (isBNBOutput) {
      // Token to BNB output: direct path
      console.log(`\n🏦 BNB OUTPUT PATH:`);
      console.log(`   Path: [${normalizedTokenIn.substring(0, 14)}..., WBNB]`);
      swapPath = buildSwapPath(normalizedTokenIn, normalizedTokenOut);
    } else {
      // Token to token: may route through WBNB
      console.log(`\n🔀 TOKEN TO TOKEN PATH:`);
      swapPath = buildSwapPath(normalizedTokenIn, normalizedTokenOut);
      console.log(`   Path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" → ")}]`);
    }

    if (isBNBInput) {
      // BNB to token: Two-step approach for better compatibility
      // Step 1: Wrap native BNB → WBNB via deposit()
      // Step 2: Swap WBNB → LEXA via router
      
      console.log(`\n✅ TWO-STEP SWAP (native BNB): Wrap then Swap`);
      console.log(`   Step 1: WBNB.deposit() - Convert native BNB → WBNB tokens`);
      console.log(`   Step 2: Router.swapExactTokensForTokens(WBNB → LEXA)`);
      console.log(`   User sends: ${ethers.formatEther(amountInWei)} BNB as value in Step 1`);
      
      // DIAGNOSTIC: Ensure path elements are properly formatted
      console.log(`\n🔍 PATH VALIDATION BEFORE ENCODING:`);
      console.log(`   Path[0] (WBNB): ${swapPath[0]}`);
      console.log(`   Path[1] (Output): ${swapPath[1]}`);
      console.log(`   Path length: ${swapPath.length}`);
      
      // Create WBNB deposit call (wraps BNB → WBNB)
      const wbnbIface = new ethers.Interface(WBNB_ABI);
      const wrapData = wbnbIface.encodeFunctionData("deposit", []);
      
      console.log(`✓ WBNB.deposit() encoded successfully`);
      console.log(`  Data length: ${wrapData.length} chars`);
      
      // Create token-to-token swap call (WBNB → LEXA)
      swapData = routerIface.encodeFunctionData("swapExactTokensForTokens", [
        amountInWei.toString(),  // We'll have exactly this amount of WBNB after wrapping
        minimumAmountOutWei.toString(),
        swapPath,
        normalizedWalletAddress,
        deadline,
      ]);
      
      console.log(`✓ Router.swapExactTokensForTokens() encoded successfully`);
      console.log(`  Encoded data length: ${swapData.length} chars`);
      console.log(`  Function selector: ${swapData.substring(0, 10)}`);
      
      // Return both transactions: wrap first, then swap
      // We need to modify the response to include both transactions
      txValue = amountInWei.toString();
      
      // Store the wrap transaction for returning alongside the swap
      const wrapTx = {
        to: WBNB_ADDRESS,  // Send to WBNB contract
        data: wrapData,
        value: txValue,   // Send native BNB here
      };
      
      // For now, we'll encode both in the swap response
      // The frontend will need to execute wrap first, then swap
      console.log(`\n📝 TRANSACTION SEQUENCE:`);
      console.log(`   1st TX: WBNB.deposit() to ${WBNB_ADDRESS}`);
      console.log(`      Value: ${ethers.formatEther(txValue)} BNB`);
      console.log(`   2nd TX: Router.swapExactTokensForTokens() to ${PANCAKESWAP_ROUTER_ADDRESS}`);
      console.log(`      Value: 0 (no native BNB needed, using WBNB tokens from wrap)`);
    } else if (isBNBOutput) {
      // Token to BNB: call swapExactTokensForBNB
      console.log(`\n✅ Using swapExactTokensForBNB`);
      console.log(`   This swaps token back to native BNB`);
      swapData = routerIface.encodeFunctionData("swapExactTokensForBNB", [
        amountInWei.toString(),
        minimumAmountOutWei.toString(),
        swapPath,
        normalizedWalletAddress,
        deadline,
      ]);
    } else {
      // Token to token: call swapExactTokensForTokens
      console.log(`\n✅ Using swapExactTokensForTokens`);
      console.log(`   This swaps between two tokens`);
      swapData = routerIface.encodeFunctionData("swapExactTokensForTokens", [
        amountInWei.toString(),
        minimumAmountOutWei.toString(),
        swapPath,
        normalizedWalletAddress,
        deadline,
      ]);
    }

    console.log(`✓ Encoded Router V2 swap call`);
    console.log(`  Function: ${isBNBInput ? "swapExactTokensForTokens (after wrap)" : isBNBOutput ? "swapExactTokensForBNB" : "swapExactTokensForTokens"}`);
    console.log(`  Input amount: ${ethers.formatEther(amountInWei)} ${isBNBInput ? "WBNB (from wrap)" : "tokens"}`);
    console.log(`  Minimum output: ${ethers.formatEther(minimumAmountOutWei)}`);
    console.log(`  Path: [${swapPath.map(p => p.substring(0, 14) + "...").join(" -> ")}]`);
    console.log(`  Recipient: ${normalizedWalletAddress.substring(0, 14)}...`);
    console.log(`  Deadline: ${deadline}`);
    console.log(`  Value to send: ${isBNBInput ? ethers.formatEther(txValue) + " BNB (for wrap)" : "0"}`);

    // For token input, we need approval transaction first
    let approvalData = null;
    if (!isBNBInput) {
      const tokenIface = new ethers.Interface(ERC20_ABI);
      // Approve Router V2 to spend the tokens
      approvalData = tokenIface.encodeFunctionData("approve", [
        PANCAKESWAP_ROUTER_ADDRESS,
        amountInWei.toString(),
      ]);
      console.log(`✓ Will request approval for Router V2: ${PANCAKESWAP_ROUTER_ADDRESS.substring(0, 14)}...`);
    }

    console.log(`✅ [PREPARE-SWAP] RETURNING SWAP TO ROUTER: ${PANCAKESWAP_ROUTER_ADDRESS}`);

    // Build response
    // For native BNB input, we need to return wrap, approval, and swap transactions
    let response: any = {
      swap: {
        to: PANCAKESWAP_ROUTER_ADDRESS,
        data: swapData,
        value: isBNBInput ? "0" : txValue,  // Only for non-BNB input (swap value), wrap value handled separately
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
      },
    };

    // If input is native BNB, add the wrap transaction and WBNB approval
    if (isBNBInput) {
      const wbnbIface = new ethers.Interface(WBNB_ABI);
      const wrapData = wbnbIface.encodeFunctionData("deposit", []);
      
      // Create approval for router to spend WBNB tokens after wrapping
      const wbnbApprovalIface = new ethers.Interface(ERC20_ABI);
      const wbnbApprovalData = wbnbApprovalIface.encodeFunctionData("approve", [
        PANCAKESWAP_ROUTER_ADDRESS,
        amountInWei.toString(),
      ]);
      
      response.wrap = {
        to: WBNB_ADDRESS,
        data: wrapData,
        value: txValue,  // Native BNB amount to wrap
      };
      
      response.wrapApproval = {
        to: WBNB_ADDRESS,
        data: wbnbApprovalData,
        value: "0",  // No native value needed for approval
      };
      
      response.details.transactionSequence = [
        "1. Send native BNB to WBNB.deposit() to wrap it into WBNB tokens",
        "2. Approve router to spend your WBNB tokens via WBNB.approve(router, amount)",
        "3. Send WBNB tokens to Router via swapExactTokensForTokens() to swap to LEXA"
      ];
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

function buildSwapPath(tokenIn: string, tokenOut: string): string[] {
  const WBNB = WBNB_ADDRESS.toLowerCase();
  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();

  // Direct swap if one is WBNB
  if (normalizedIn === WBNB || normalizedOut === WBNB) {
    return [ethers.getAddress(tokenIn.toLowerCase()), ethers.getAddress(tokenOut.toLowerCase())];
  }

  // Route through WBNB for other pairs
  return [ethers.getAddress(tokenIn.toLowerCase()), ethers.getAddress(WBNB_ADDRESS.toLowerCase()), ethers.getAddress(tokenOut.toLowerCase())];
}
