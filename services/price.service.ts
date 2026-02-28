// services/price.service.ts
import { TOKENS } from "@/constants/tokens";
import { pancakeSwapService } from "@/services/pancakeswap.service";
import { ethers } from "ethers";

interface PriceData {
  bnb: number;
  lexa: number;
  lastUpdated: number;
}

class PriceService {
  private cachedPrices: PriceData | null = null;
  private cacheExpiry = 60000; // Cache for 60 seconds

  /**
   * Get current prices for BNB and LEXA
   * - BNB from CoinGecko
   * - LEXA from PancakeSwap (direct DEX price)
   */
  async getPrices(): Promise<PriceData> {
    // Return cached prices if still valid
    if (
      this.cachedPrices &&
      Date.now() - this.cachedPrices.lastUpdated < this.cacheExpiry
    ) {
      return this.cachedPrices;
    }

    try {
      // Fetch BNB price from CoinGecko
      let bnbPrice = 0;
      try {
        const bnbResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
          { cache: "no-store" }
        );

        if (bnbResponse.ok) {
          const bnbData = await bnbResponse.json();
          bnbPrice = bnbData.binancecoin?.usd || 0;
        }
      } catch (error) {
        console.warn("Failed to fetch BNB price from CoinGecko:", error);
      }

      // Fetch LEXA price from PancakeSwap
      let lexaPrice = 0;
      try {
        console.log("📡 Fetching LEXA price from PancakeSwap...");
        
        // Get 1 LEXA in BUSD equivalent using PancakeSwap quote
        // 1 LEXA = 1 * 10^18 wei
        const oneToken = "1";
        
        const quote = await pancakeSwapService.getSwapQuote(
          TOKENS.LEXA.address,
          TOKENS.BUSD.address,
          oneToken,
          0 // No slippage for quote purposes
        );
        
        lexaPrice = parseFloat(quote.amountOut);
        console.log("✓ LEXA price from PancakeSwap:", lexaPrice, "BUSD");
        
      } catch (error) {
        console.warn("Failed to fetch LEXA price from PancakeSwap:", error);
        
        // Fallback: Try to get from CoinGecko
        try {
          const lexaResponse = await fetch(
            "https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?contract_addresses=" +
            TOKENS.LEXA.address +
            "&vs_currencies=usd",
            { cache: "no-store" }
          );

          if (lexaResponse.ok) {
            const lexaData = await lexaResponse.json();
            lexaPrice = lexaData[TOKENS.LEXA.address.toLowerCase()]?.usd || 0;
            if (lexaPrice > 0) {
              console.log("✓ LEXA price from CoinGecko (fallback):", lexaPrice);
            }
          }
        } catch (fallbackError) {
          console.warn("Failed to fetch LEXA price from CoinGecko fallback:", fallbackError);
        }
      }

      const prices: PriceData = {
        bnb: bnbPrice,
        lexa: lexaPrice,
        lastUpdated: Date.now(),
      };

      this.cachedPrices = prices;
      return prices;
    } catch (error) {
      console.error("Error fetching prices:", error);
      return this.getDefaultPrices();
    }
  }

  /**
   * Get default prices (fallback)
   */
  private getDefaultPrices(): PriceData {
    return {
      bnb: 0,
      lexa: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Calculate USD value for a token amount
   */
  calculateUsdValue(amount: string, tokenPrice: number): string {
    if (!amount || !tokenPrice || tokenPrice === 0) {
      return "0.00";
    }

    const usdValue = parseFloat(amount) * tokenPrice;
    return usdValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

export const priceService = new PriceService();
