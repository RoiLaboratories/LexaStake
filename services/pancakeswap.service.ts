import { ethers } from "ethers";
import { TOKENS } from "@/constants/tokens";

// PancakeSwap Router V2 address on BSC mainnet
export const PANCAKESWAP_ROUTER_ADDRESS =
  "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// PancakeSwap Router V2 ABI (relevant functions)
export const PANCAKESWAP_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "amountInMax", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactBNBForTokens",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactBNB",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForBNB",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "amountInMax", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactBNB",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
    ],
    name: "getAmountsOut",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "uint256", name: "amountOut", type: "uint256" },
    ],
    name: "getAmountsIn",
    outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
];

// ERC20 ABI for token approvals
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

// WBNB address (wrapped BNB)
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaebF2De08d9173bc095c";

interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number; // in percentage (e.g., 0.5 = 0.5%)
  walletAddress: string;
}

interface SwapQuoteData {
  amountIn: string;
  amountOut: string;
  minimumAmountOut: string;
  priceImpact: number;
  path: string[];
}

interface PreparedSwapTransaction {
  swap: {
    to: string;
    data: string;
    value: string;
  };
  approval: {
    to: string;
    data: string;
  } | null;
  details: {
    amountIn: string;
    amountOut: string;
    minimumAmountOut: string;
    path: string[];
    deadline: number;
  };
}

class PancakeSwapService {
  /**
   * Get swap quote from PancakeSwap
   */
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippage: number = 0.5,
  ): Promise<SwapQuoteData> {
    try {
      // Build the path (direct or through WBNB)
      const path = this.buildSwapPath(tokenIn, tokenOut);

      // Validate amountIn is a string number
      const amountInStr = String(amountIn).trim();
      if (!amountInStr || isNaN(parseFloat(amountInStr))) {
        throw new Error(`Invalid amountIn: expected a number string, got "${amountIn}"`);
      }

      console.log("📤 Sending quote request:", { path, amountIn: amountInStr, slippage });

      // Get amounts out
      const response = await fetch("/api/pancakeswap/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          amountIn: amountInStr,
          slippage,
        }),
      });

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = (errorData as {error?: string, details?: string}).error || 
                    (errorData as {details?: string}).details || 
                    errorMsg;
        } catch (e) {
          // Could not parse error response
        }
        throw new Error(`API returned ${response.status}: ${errorMsg}`);
      }

      const { amountOut, minimumAmountOut, priceImpact, path: responsePath } =
        await response.json();

      console.log("✓ Quote received:", { amountOut, minimumAmountOut, priceImpact });

      return {
        amountIn: amountInStr,
        amountOut,
        minimumAmountOut,
        priceImpact,
        path: responsePath || path,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Error fetching swap quote:", errorMsg);
      throw error;
    }
  }

  /**
   * Prepare swap transaction data
   */
  async prepareSwapTransaction(params: SwapParams): Promise<PreparedSwapTransaction> {
    try {
      const response = await fetch("/api/pancakeswap/prepare-swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error("Failed to prepare swap transaction");
      }

      return await response.json();
    } catch (error) {
      console.error("Error preparing swap transaction:", error);
      throw error;
    }
  }

  /**
   * Build swap path based on token pair
   * For WBNB/LEXA: direct path
   * For other pairs: route through WBNB
   */
  private buildSwapPath(tokenIn: string, tokenOut: string): string[] {
    const normalizedIn = tokenIn.toLowerCase();
    const normalizedOut = tokenOut.toLowerCase();
    const wbnb = WBNB_ADDRESS.toLowerCase();

    // Direct swap if both are WBNB/LEXA
    if (
      (normalizedIn === wbnb && normalizedOut === TOKENS.LEXA.address.toLowerCase()) ||
      (normalizedIn === TOKENS.LEXA.address.toLowerCase() && normalizedOut === wbnb)
    ) {
      return [tokenIn, tokenOut];
    }

    // Route through WBNB for other pairs
    if (normalizedIn === wbnb || normalizedOut === wbnb) {
      return [tokenIn, tokenOut];
    }

    // Default: route through WBNB
    return [tokenIn, WBNB_ADDRESS, tokenOut];
  }
}

export const pancakeSwapService = new PancakeSwapService();
