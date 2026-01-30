import { Token } from "@/types/swap.types";

export const TOKENS: Record<string, Token> = {
  LEXA: {
    symbol: "LEXA",
    name: "LEXA Token",
    logoPath: "/assets/LexaLogo2.svg",
    decimals: 18,
    address: "0x...", // Replace with actual contract address
  },
  BNB: {
    symbol: "BNB",
    name: "Binance Coin",
    logoPath: "/assets/bnb.svg",
    decimals: 18,
    address: "0x...", // Replace with actual contract address
  },
  // Add more tokens as needed
};

export const DEFAULT_SLIPPAGE = "0.2";
export const SLIPPAGE_OPTIONS = ["0.1", "0.2", "0.5"];
