// services/price.service.ts
import { TOKENS } from "@/constants/tokens";

interface PriceData {
  bnb: number;
  lexa: number;
  lastUpdated: number;
}

class PriceService {
  private cachedPrices: PriceData | null = null;
  private cacheExpiry = 60000; // Cache for 60 seconds

  /**
   * Get current prices for BNB and LEXA from CoinGecko API
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
      const bnbResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
        { cache: "no-store" }
      );

      if (!bnbResponse.ok) {
        console.warn("Failed to fetch BNB price");
        return this.getDefaultPrices();
      }

      const bnbData = await bnbResponse.json();
      const bnbPrice = bnbData.binancecoin?.usd || 0;

      // For LEXA, we need to calculate from DEX or use a fallback
      // Since LEXA is a smaller token, we'll fetch from pancakeswap or estimate
      let lexaPrice = 0;
      try {
        // Try to get LEXA price from CoinGecko (if listed)
        // If not listed, we'll need to calculate from pool ratio or use 0
        const lexaResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?contract_addresses=" +
          TOKENS.LEXA.address +
          "&vs_currencies=usd",
          { cache: "no-store" }
        );

        if (lexaResponse.ok) {
          const lexaData = await lexaResponse.json();
          lexaPrice =
            lexaData[TOKENS.LEXA.address.toLowerCase()]?.usd || 0;
        }
      } catch (error) {
        console.warn("Failed to fetch LEXA price:", error);
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
