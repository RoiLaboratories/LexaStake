// hooks/useSwap.ts
import { useState, useCallback, useEffect } from "react";
import { Token, TransactionStatus, SwapQuote } from "@/types/swap.types";
import { pancakeSwapService } from "@/services/pancakeswap.service";
import { DEFAULT_SLIPPAGE, TOKENS } from "@/constants/tokens";
import { usePrivy } from "@privy-io/react-auth";
import { BrowserProvider } from "ethers";

export const useSwap = () => {
  const { user } = usePrivy();
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
        const quoteData = await pancakeSwapService.getSwapQuote(
          sellToken.address,
          receiveToken.address,
          sellAmount,
          parseFloat(slippage === "custom" ? customSlippage : slippage),
        );
        setQuote({
          inputAmount: quoteData.amountIn,
          outputAmount: quoteData.amountOut,
          exchangeRate: parseFloat(quoteData.amountOut) / parseFloat(quoteData.amountIn),
          priceImpact: quoteData.priceImpact,
          minimumReceived: quoteData.minimumAmountOut,
          fee: "0",
        });
        setReceiveAmount(quoteData.amountOut);
      } catch (error) {
        console.error("Error fetching quote:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounceTimer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [sellAmount, sellToken, receiveToken, slippage, customSlippage]);

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
      if (!user?.wallet?.address) {
        console.error("Wallet not connected");
        setTransactionStatus("error");
        return;
      }

      setTransactionStatus("loading");

      try {
        const effectiveSlippage = slippage === "custom" ? customSlippage : slippage;

        // Prepare swap transaction
        const preparedSwap = await pancakeSwapService.prepareSwapTransaction({
          tokenIn: sellToken.address,
          tokenOut: receiveToken.address,
          amountIn: sellAmount,
          slippage: parseFloat(effectiveSlippage),
          walletAddress,
        });

        // Get the signer from Privy
        const provider = new BrowserProvider(window.ethereum!);
        const signer = await provider.getSigner();

        // Execute approval transaction if needed
        if (preparedSwap.approval) {
          console.log("Executing approval transaction...");
          const approveTx = {
            to: preparedSwap.approval.to,
            data: preparedSwap.approval.data,
          };

          const approveTxResponse = await signer.sendTransaction(approveTx);
          const approveReceipt = await approveTxResponse.wait();
          
          if (!approveReceipt || approveReceipt.status === 0) {
            throw new Error("Approval transaction failed");
          }
          console.log("Approval successful:", approveReceipt.hash);
        }

        // Execute swap transaction
        console.log("Executing swap transaction...");
        const swapTx = {
          to: preparedSwap.swap.to,
          data: preparedSwap.swap.data,
          value: preparedSwap.swap.value,
        };

        const swapTxResponse = await signer.sendTransaction(swapTx);
        const swapReceipt = await swapTxResponse.wait();

        if (!swapReceipt || swapReceipt.status === 0) {
          throw new Error("Swap transaction failed");
        }

        console.log("Swap successful:", swapReceipt.hash);
        setTransactionStatus("success");
        
        // Clear amounts after successful swap
        setSellAmount("");
        setReceiveAmount("");
        setQuote(null);
      } catch (error) {
        console.error("Error executing swap:", error);
        setTransactionStatus("error");
      }
    },
    [sellToken, receiveToken, sellAmount, slippage, customSlippage, user],
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
