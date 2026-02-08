import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const PANCAKESWAP_ROUTER_ADDRESS = "0x10ED43C718714eb63d2C564e90f37d778D30ecC84";
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

    // Normalize addresses
    let normalizedTokenIn: string;
    let normalizedTokenOut: string;
    let normalizedWalletAddress: string;
    
    try {
      normalizedTokenIn = ethers.getAddress(tokenIn);
    } catch {
      normalizedTokenIn = tokenIn.toLowerCase();
    }
    
    try {
      normalizedTokenOut = ethers.getAddress(tokenOut);
    } catch {
      normalizedTokenOut = tokenOut.toLowerCase();
    }
    
    try {
      normalizedWalletAddress = ethers.getAddress(walletAddress);
    } catch {
      normalizedWalletAddress = walletAddress.toLowerCase();
    }

    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_NETWORK, { staticNetwork: true });
    const router = new ethers.Contract(
      PANCAKESWAP_ROUTER_ADDRESS,
      ROUTER_ABI,
      makeBscRunner(provider),
    );

    // Build path with normalized addresses
    const path = buildSwapPath(normalizedTokenIn, normalizedTokenOut);

    // Convert amountIn to wei (assuming 18 decimals)
    const amountInWei = ethers.parseEther(amountIn);

    // Get amounts out with error handling
    let amounts: bigint[];
    let lastError: Error | null = null;
    
    for (const rpcUrl of BSC_RPC_URLS) {
      try {
        const rpcProvider = new ethers.JsonRpcProvider(rpcUrl, BSC_NETWORK, { staticNetwork: true });
        const rpcRouter = new ethers.Contract(
          PANCAKESWAP_ROUTER_ADDRESS,
          ROUTER_ABI,
          makeBscRunner(rpcProvider),
        );
        amounts = await rpcRouter.getAmountsOut(amountInWei, path);
        lastError = null;
        break;
      } catch (error) {
        lastError = error as Error;
        console.warn(`RPC ${rpcUrl} failed:`, (error as Error).message);
        continue;
      }
    }

    if (lastError) {
      throw lastError;
    }

    const amountOutWei = amounts![amounts!.length - 1];

    // Calculate minimum amount with slippage
    const slippagePercentage = parseFloat(slippage) || 0.5;
    const minimumAmountOutWei = (amountOutWei * BigInt(10000 - Math.round(slippagePercentage * 100))) / BigInt(10000);

    // Set deadline to 20 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

    // Determine which swap function to use based on input token
    const isBNBInput = normalizedTokenIn.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const isBNBOutput = normalizedTokenOut.toLowerCase() === WBNB_ADDRESS.toLowerCase();

    // Create swap function signature
    const swapSignatures = {
      swapExactTokensForTokens: "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
      swapExactTokensForBNB: "function swapExactTokensForBNB(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
      swapExactBNBForTokens: "function swapExactBNBForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
    };

    let swapFunctionSig: string;
    let swapParams: (string | string[] | number)[];

    if (isBNBInput) {
      // swapExactBNBForTokens
      swapFunctionSig = swapSignatures.swapExactBNBForTokens;
      swapParams = [minimumAmountOutWei.toString(), path, normalizedWalletAddress, deadline];
    } else if (isBNBOutput) {
      // swapExactTokensForBNB
      swapFunctionSig = swapSignatures.swapExactTokensForBNB;
      swapParams = [amountInWei.toString(), minimumAmountOutWei.toString(), path, normalizedWalletAddress, deadline];
    } else {
      // swapExactTokensForTokens
      swapFunctionSig = swapSignatures.swapExactTokensForTokens;
      swapParams = [amountInWei.toString(), minimumAmountOutWei.toString(), path, normalizedWalletAddress, deadline];
    }

    // Encode the swap function call
    const iface = new ethers.Interface([swapFunctionSig]);
    const functionName = isBNBInput ? "swapExactBNBForTokens" : (isBNBOutput ? "swapExactTokensForBNB" : "swapExactTokensForTokens");
    const swapData = iface.encodeFunctionData(functionName, swapParams);

    // For non-BNB input, we need approval transaction first
    let approvalData = null;
    if (!isBNBInput) {
      const tokenIface = new ethers.Interface(ERC20_ABI);
      approvalData = tokenIface.encodeFunctionData("approve", [
        PANCAKESWAP_ROUTER_ADDRESS,
        amountInWei.toString(),
      ]);
    }

    return NextResponse.json({
      swap: {
        to: PANCAKESWAP_ROUTER_ADDRESS,
        data: swapData,
        value: isBNBInput ? amountInWei.toString() : "0",
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
