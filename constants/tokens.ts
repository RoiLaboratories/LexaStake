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
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    logoPath: "/assets/usdt.svg",
    decimals: 18,
    address: "0x55d398326f99059fF775485246999027B3197955",
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

export const SWAP_TOKENS = [TOKENS.LEXA, TOKENS.BNB, TOKENS.USDT];

export const DEFAULT_SLIPPAGE = "10"; // LEXA/BNB requires at least 7% because of thin liquidity and token taxes.
export const SLIPPAGE_OPTIONS = ["0.1", "0.5", "1", "2", "5", "7", "10"];
