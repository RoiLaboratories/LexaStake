export type Token = {
  symbol: string;
  name: string;
  logoPath: string;
  decimals: number;
  address: string;
};

export type TransactionStatus = "idle" | "loading" | "success" | "error";

export type SwapFormData = {
  sellToken: Token;
  receiveToken: Token;
  sellAmount: string;
  receiveAmount: string;
  slippage: string;
};

export type SwapQuote = {
  inputAmount: string;
  outputAmount: string;
  exchangeRate: number;
  priceImpact: number;
  minimumReceived: string;
  fee: string;
};

export type TransactionResult = {
  hash: string;
  status: "success" | "failed";
  message: string;
};

export type WalletBalance = {
  token: string;
  balance: string;
  usdValue: string;
};
