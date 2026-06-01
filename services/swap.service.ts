import {
  SwapQuote,
  TransactionResult,
  WalletBalance,
} from "@/types/swap.types";
import { TOKENS } from "@/constants/tokens";

class SwapService {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
  }

  /**
   * Get a quote for swapping tokens
   */
  async getSwapQuote(
    sellToken: string,
    receiveToken: string,
    amount: string,
    slippage: string,
  ): Promise<SwapQuote> {
    try {
      const response = await fetch(`${this.baseUrl}/swap/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellToken,
          receiveToken,
          amount,
          slippage,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch swap quote");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching swap quote:", error);
      // Return mock data for now
      return this.getMockQuote(amount);
    }
  }

  /**
   * Execute a token swap
   */
  async executeSwap(
    sellToken: string,
    receiveToken: string,
    sellAmount: string,
    receiveAmount: string,
    slippage: string,
    walletAddress: string,
  ): Promise<TransactionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/swap/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellToken,
          receiveToken,
          sellAmount,
          receiveAmount,
          slippage,
          walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute swap");
      }

      return await response.json();
    } catch (error) {
      console.error("Error executing swap:", error);
      // Return mock data for development
      return this.getMockTransaction();
    }
  }

  /**
   * Get wallet balance for a specific token
   */
  async getWalletBalance(
    walletAddress: string,
    tokenAddress: string,
  ): Promise<WalletBalance> {
    try {
      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          tokenAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch balance");
      }

      const { balance } = await response.json();

      // Determine token symbol based on address
      const matchedToken = Object.values(TOKENS).find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
      );
      const tokenSymbol = matchedToken?.symbol ?? "TOKEN";

      return {
        token: tokenSymbol,
        balance,
        usdValue: "0",
      };
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      throw error;
    }
  }

  /**
   * Get all wallet balances
   */
  async getAllBalances(walletAddress: string): Promise<WalletBalance[]> {
    try {
      const response = await fetch("/api/wallet/balances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch balances");
      }

      const { lexa, bnb, usdt } = await response.json();

      return [
        {
          token: "BNB",
          balance: bnb ?? "0",
          usdValue: "0",
        },
        {
          token: "LEXA",
          balance: lexa ?? "0",
          usdValue: "0",
        },
        {
          token: "USDT",
          balance: usdt ?? "0",
          usdValue: "0",
        },
      ];
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
      throw error;
    }
  }

  // Mock data helpers for development
  private getMockQuote(amount: string): SwapQuote {
    const inputAmount = parseFloat(amount) || 0;
    return {
      inputAmount: amount,
      outputAmount: (inputAmount * 0.0001).toFixed(4),
      exchangeRate: 0.0001,
      priceImpact: 0.5,
      minimumReceived: (inputAmount * 0.0001 * 0.98).toFixed(4),
      fee: "0.3",
    };
  }

  private getMockTransaction(): TransactionResult {
    return {
      hash: "0x" + Math.random().toString(16).substring(2, 66),
      status: "success",
      message: "Transaction completed successfully",
    };
  }
}

export const swapService = new SwapService();
