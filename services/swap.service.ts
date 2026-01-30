import {
  SwapQuote,
  TransactionResult,
  WalletBalance,
} from "@/types/swap.types";

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
      const response = await fetch(
        `${this.baseUrl}/wallet/${walletAddress}/balance/${tokenAddress}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch wallet balance");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      // Return mock data
      return {
        token: "LEXA",
        balance: "100000",
        usdValue: "0",
      };
    }
  }

  /**
   * Get all wallet balances
   */
  async getAllBalances(walletAddress: string): Promise<WalletBalance[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/wallet/${walletAddress}/balances`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch wallet balances");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
      return [];
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
