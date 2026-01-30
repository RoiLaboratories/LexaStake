// hooks/useSwap.ts
import { useState, useCallback, useEffect } from "react";
import { Token, TransactionStatus, SwapQuote } from "@/types/swap.types";
import { swapService } from "@/services/swap.service";
import { DEFAULT_SLIPPAGE, TOKENS } from "@/constants/tokens";

export const useSwap = () => {
  const [sellToken, setSellToken] = useState<Token>(TOKENS.LEXA);
  const [receiveToken, setReceiveToken] = useState<Token>(TOKENS.BNB);
  const [sellAmount, setSellAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [customSlippage, setCustomSlippage] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [balance, setBalance] = useState("0");
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Fetch quote when amounts or tokens change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!sellAmount || parseFloat(sellAmount) === 0) {
        setReceiveAmount("");
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const quoteData = await swapService.getSwapQuote(
          sellToken.symbol,
          receiveToken.symbol,
          sellAmount,
          slippage,
        );
        setQuote(quoteData);
        setReceiveAmount(quoteData.outputAmount);
      } catch (error) {
        console.error("Error fetching quote:", error);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounceTimer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [sellAmount, sellToken, receiveToken, slippage]);

  const swapTokens = useCallback(() => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);

    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  }, [sellToken, receiveToken, sellAmount, receiveAmount]);

  const handleMaxAmount = useCallback(() => {
    setSellAmount(balance);
  }, [balance]);

  const handlePercentage = useCallback(
    (percentage: number) => {
      const amount = (parseFloat(balance) * percentage).toString();
      setSellAmount(amount);
    },
    [balance],
  );

  const executeSwap = useCallback(
    async (walletAddress: string) => {
      if (!sellAmount || parseFloat(sellAmount) === 0) return;

      setTransactionStatus("loading");

      try {
        const result = await swapService.executeSwap(
          sellToken.symbol,
          receiveToken.symbol,
          sellAmount,
          receiveAmount,
          slippage,
          walletAddress,
        );

        if (result.status === "success") {
          setTransactionStatus("success");
          // Clear amounts after successful swap
          setSellAmount("");
          setReceiveAmount("");
          setQuote(null);
        } else {
          setTransactionStatus("error");
        }
      } catch (error) {
        console.error("Error executing swap:", error);
        setTransactionStatus("error");
      }
    },
    [sellToken, receiveToken, sellAmount, receiveAmount, slippage],
  );

  const resetTransaction = useCallback(() => {
    setTransactionStatus("idle");
  }, []);

  const updateBalance = useCallback((newBalance: string) => {
    setBalance(newBalance);
  }, []);

  return {
    // State
    sellToken,
    receiveToken,
    sellAmount,
    receiveAmount,
    slippage,
    customSlippage,
    quote,
    transactionStatus,
    balance,
    isLoadingQuote,

    // Actions
    setSellToken,
    setReceiveToken,
    setSellAmount,
    setReceiveAmount,
    setSlippage,
    setCustomSlippage,
    swapTokens,
    handleMaxAmount,
    handlePercentage,
    executeSwap,
    resetTransaction,
    updateBalance,
  };
};
