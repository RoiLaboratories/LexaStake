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

export type UseSwapReturn = {
  // State
  sellToken: Token;
  receiveToken: Token;
  sellAmount: string;
  receiveAmount: string;
  slippage: string;
  customSlippage: string;
  quote: SwapQuote | null;
  transactionStatus: TransactionStatus;
  balance: string;
  isLoadingQuote: boolean;
  prices: { bnb: number; lexa: number };
  errorMessage: string | null;
  transactionHash: string | null;
  lastTransactionSellAmount: string;
  lastTransactionReceiveAmount: string;
  lastTransactionSellToken: Token;
  lastTransactionReceiveToken: Token;
  
  // Setters
  setSellToken: (token: Token) => void;
  setReceiveToken: (token: Token) => void;
  setSellAmount: (amount: string) => void;
  setReceiveAmount: (amount: string) => void;
  setSlippage: (slippage: string) => void;
  setCustomSlippage: (slippage: string) => void;
  
  // Actions
  swapTokens: () => void;
  handleMaxAmount: () => void;
  handlePercentage: (percentage: number) => void;
  resetSwapInputs: () => void;
  executeSwap: (walletAddress: string) => Promise<void>;
  resetTransaction: () => void;
  updateBalance: (newBalance: string) => void;
};
