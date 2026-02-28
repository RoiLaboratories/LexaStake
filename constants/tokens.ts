import { Token } from "@/types/swap.types";

export const TOKENS: Record<string, Token> = {
  LEXA: {
    symbol: "LEXA",
    name: "LEXA Token",
    logoPath: "/assets/LexaLogo2.svg",
    decimals: 18,
    address: "0x6fc20e595A8704725DBd160E7c799665706e0bdD",
  },
  BNB: {
    symbol: "BNB",
    name: "Binance Coin",
    logoPath: "/assets/bnb.svg",
    decimals: 18,
    // Use wrapped BNB (WBNB) on BSC mainnet for ERC20 balance queries
    address: "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c",
  },
  BUSD: {
    symbol: "BUSD",
    name: "Binance USD",
    logoPath: "/assets/busd.svg",
    decimals: 18,
    address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  },
  // Add more tokens as needed
};

export const DEFAULT_SLIPPAGE = "0.5"; // 15% slippage accounts for LEXA's 5% tax + volatility + fees
export const SLIPPAGE_OPTIONS = ["0.1", "0.5", "1", "2", "5", "10"];
