/**
 * Enhanced useSwap Hook
 * Manages swap state and operations with proper error handling for Privy + PancakeSwap
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { BrowserProvider, ethers } from "ethers";
import { Token, TransactionStatus, SwapQuote } from "@/types/swap.types";
import { TOKENS, DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS } from "@/constants/tokens";
import { priceService } from "@/services/price.service";
import {
  getTokenBalance,
  getUserBalances,
  getSwapQuote,
  calculateMinimumOutput,
  executeSwap,
  verifyBSCNetwork,
  SwapError,
  InsufficientBalanceError,
  ApprovalError,
  SwapExecutionError,
} from "@/utils/swapUtils";

const WBNB_ADDRESS = "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c";

export const useSwap = () => {
  // ========================================================================
  // Privy & Wallet
  // ========================================================================

  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;

  // ========================================================================
  // Swap State
  // ========================================================================

  const [sellToken, setSellToken] = useState<Token>(TOKENS.LEXA);
  const [receiveToken, setReceiveToken] = useState<Token>(TOKENS.BNB);
  const [sellAmount, setSellAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [customSlippage, setCustomSlippage] = useState("");

  // ========================================================================
  // Quote & Transaction State
  // ========================================================================

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");

  // ========================================================================
  // Balance & Price State
  // ========================================================================

  const [balance, setBalance] = useState("0");
  const [prices, setPrices] = useState<{ bnb: number; lexa: number }>({
    bnb: 0,
    lexa: 0,
  });

  // ========================================================================
  // Refs
  // ========================================================================

  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const balanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // Effects: Fetch Quotes
  // ========================================================================

  /**
   * Fetch swap quote when sell amount or tokens change
   */
  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
    }

    const fetchQuote = async () => {
      if (!sellAmount || parseFloat(sellAmount) === 0) {
        setReceiveAmount("");
        setQuote(null);
        return;
      }

      if (!authenticated || !walletAddress) {
        setErrorMessage("Wallet not connected");
        return;
      }

      setIsLoadingQuote(true);
      setErrorMessage(null);

      try {
        // Get provider from Privy
        const provider = new BrowserProvider(window.ethereum!);

        // Verify we're on BSC
        await verifyBSCNetwork(provider);

        // Get quote
        const quoteData = await getSwapQuote(
          provider,
          sellAmount,
          sellToken.address,
          receiveToken.address,
        );

        setQuote({
          inputAmount: quoteData.amountIn,
          outputAmount: quoteData.amountOut,
          exchangeRate: parseFloat(quoteData.exchangeRate),
          priceImpact: 0, // Can be calculated based on token balances
          minimumReceived: calculateMinimumOutput(
            quoteData.amountOut,
            slippage === "custom" ? customSlippage : slippage,
          ),
          fee: "0.3", // PancakeSwap default fee
        });

        setReceiveAmount(quoteData.amountOut);
        setErrorMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Quote fetch error:", error);

        // Don't show error for network issues, just clear quote
        if (message.includes("Wrong network")) {
          setErrorMessage("Please switch to BSC mainnet");
        } else if (!message.includes("fetch")) {
          setErrorMessage(null); // Silent fail for now
        }

        setQuote(null);
        setReceiveAmount("");
      } finally {
        setIsLoadingQuote(false);
      }
    };

    // Debounce quote fetching
    quoteTimeoutRef.current = setTimeout(fetchQuote, 800);

    return () => {
      if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    };
  }, [
    sellAmount,
    sellToken,
    receiveToken,
    slippage,
    customSlippage,
    authenticated,
    walletAddress,
  ]);

  // ========================================================================
  // Effects: Fetch Prices
  // ========================================================================

  /**
   * Fetch BNB and LEXA prices periodically
   */
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const priceData = await priceService.getPrices();
        setPrices({
          bnb: priceData.bnb,
          lexa: priceData.lexa,
        });
      } catch (error) {
        console.warn("Failed to fetch prices:", error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // ========================================================================
  // Effects: Update Balance
  // ========================================================================

  /**
   * Fetch sell token balance when authenticated or token changes
   */
  useEffect(() => {
    if (balanceTimeoutRef.current) {
      clearTimeout(balanceTimeoutRef.current);
    }

    const fetchBalance = async () => {
      if (!authenticated || !walletAddress) {
        setBalance("0");
        return;
      }

      try {
        const provider = new BrowserProvider(window.ethereum!);
        const balanceStr = await getTokenBalance(
          provider,
          sellToken.address,
          walletAddress,
        );
        setBalance(balanceStr);
      } catch (error) {
        console.warn("Failed to fetch balance:", error);
        setBalance("0");
      }
    };

    // Debounce balance fetching
    balanceTimeoutRef.current = setTimeout(fetchBalance, 500);

    return () => {
      if (balanceTimeoutRef.current) clearTimeout(balanceTimeoutRef.current);
    };
  }, [authenticated, walletAddress, sellToken]);

  // ========================================================================
  // Token Swap
  // ========================================================================

  /**
   * Swap sell token and receive token
   */
  const swapTokens = useCallback(() => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);

    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  }, [sellToken, receiveToken, sellAmount, receiveAmount]);

  // ========================================================================
  // Amount Helpers
  // ========================================================================

  /**
   * Set sell amount to max available balance
   */
  const handleMaxAmount = useCallback(() => {
    setSellAmount(balance);
  }, [balance]);

  /**
   * Set sell amount to percentage of balance
   */
  const handlePercentage = useCallback(
    (percentage: number) => {
      const amount = (parseFloat(balance) * percentage).toString();
      setSellAmount(amount);
    },
    [balance],
  );

  // ========================================================================
  // Execute Swap
  // ========================================================================

  /**
   * Main swap execution function
   */
  const executeSwapTransaction = useCallback(async () => {
    // ====================================================================
    // Pre-flight Checks
    // ====================================================================

    if (!sellAmount || parseFloat(sellAmount) === 0) {
      setErrorMessage("Please enter an amount to swap");
      return;
    }

    if (!authenticated || !walletAddress) {
      setErrorMessage("Please connect your wallet");
      return;
    }

    if (!quote) {
      setErrorMessage("Quote not available - please wait");
      return;
    }

    // Check balance
    if (parseFloat(sellAmount) > parseFloat(balance)) {
      setErrorMessage(
        `Insufficient ${sellToken.symbol} balance. You have ${balance}, need ${sellAmount}`,
      );
      return;
    }

    setTransactionStatus("loading");
    setErrorMessage(null);

    try {
      // ====================================================================
      // Get Provider & Signer
      // ====================================================================

      setLoadingMessage("Connecting to wallet...");

      if (!window.ethereum) {
        throw new SwapError("Ethereum provider not available", "NO_PROVIDER");
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ====================================================================
      // Verify Network
      // ====================================================================

      setLoadingMessage("Verifying network...");
      await verifyBSCNetwork(provider);

      // ====================================================================
      // Get Sell Token Address (handle BNB → WBNB conversion)
      // ====================================================================

      let tokenInAddress = sellToken.address;
      let tokenOutAddress = receiveToken.address;

      // BSC uses WBNB for routing, but user sees BNB
      if (sellToken.symbol === "BNB") {
        tokenInAddress = WBNB_ADDRESS;
      }
      if (receiveToken.symbol === "BNB") {
        tokenOutAddress = WBNB_ADDRESS;
      }

      // ====================================================================
      // Execute Swap
      // ====================================================================

      setLoadingMessage("Executing swap...");

      const effectiveSlippage = slippage === "custom" ? customSlippage : slippage;

      const result = await executeSwap(
        signer,
        provider,
        tokenInAddress,
        tokenOutAddress,
        sellAmount,
        quote.outputAmount,
        effectiveSlippage,
        walletAddress,
      );

      console.log("✅ Swap successful:", result.hash);

      // ====================================================================
      // Wait for Confirmation
      // ====================================================================

      setLoadingMessage("Waiting for confirmation...");

      if (result.receipt) {
        if (result.receipt.status === 0) {
          throw new SwapExecutionError("Transaction reverted");
        }
        console.log("✓ Swap confirmed in block", result.receipt.blockNumber);
      }

      setTransactionStatus("success");
      setLoadingMessage("");

      // ====================================================================
      // Reset Form
      // ====================================================================

      setSellAmount("");
      setReceiveAmount("");
      setQuote(null);

      // Refresh balance
      setTimeout(async () => {
        try {
          const newBalance = await getTokenBalance(
            provider,
            sellToken.address,
            walletAddress,
          );
          setBalance(newBalance);
        } catch (error) {
          console.warn("Failed to refresh balance:", error);
        }
      }, 2000);
    } catch (error) {
      console.error("Swap error:", error);

      let friendlyMessage = "Swap failed. Please try again.";

      if (error instanceof InsufficientBalanceError) {
        friendlyMessage = `Insufficient balance. You have ${balance} ${sellToken.symbol}`;
      } else if (error instanceof ApprovalError) {
        if (error.message.includes("rejected")) {
          friendlyMessage = "You rejected the approval. Please approve to continue.";
        } else {
          friendlyMessage = "Failed to approve token spending";
        }
      } else if (error instanceof SwapExecutionError) {
        if (error.message.includes("rejected")) {
          friendlyMessage = "You rejected the swap transaction";
        } else if (error.message.includes("slippage") || error.message.includes("insufficient")) {
          friendlyMessage =
            "Swap would fail - insufficient output or liquidity. Try increasing slippage.";
        } else {
          friendlyMessage = error.message;
        }
      } else if (error instanceof SwapError) {
        friendlyMessage = error.message;
      } else if (error instanceof Error) {
        friendlyMessage = error.message;
      }

      setErrorMessage(friendlyMessage);
      setTransactionStatus("error");
      setLoadingMessage("");
    }
  }, [
    sellAmount,
    receiveAmount,
    authenticated,
    walletAddress,
    quote,
    balance,
    sellToken,
    receiveToken,
    slippage,
    customSlippage,
  ]);

  // ========================================================================
  // Reset Transaction State
  // ========================================================================

  const resetTransaction = useCallback(() => {
    setTransactionStatus("idle");
    setErrorMessage(null);
    setLoadingMessage("");
  }, []);

  // ========================================================================
  // Update Balance (manual refresh)
  // ========================================================================

  const updateBalance = useCallback(async () => {
    if (!walletAddress) return;

    try {
      const provider = new BrowserProvider(window.ethereum!);
      const newBalance = await getTokenBalance(
        provider,
        sellToken.address,
        walletAddress,
      );
      setBalance(newBalance);
    } catch (error) {
      console.warn("Failed to update balance:", error);
    }
  }, [walletAddress, sellToken]);

  // ========================================================================
  // Return Hook API
  // ========================================================================

  return {
    // Tokens
    sellToken,
    receiveToken,
    setSellToken,
    setReceiveToken,

    // Amounts
    sellAmount,
    receiveAmount,
    setSellAmount,
    setReceiveAmount,

    // Slippage
    slippage,
    customSlippage,
    setSlippage,
    setCustomSlippage,
    slippageOptions: SLIPPAGE_OPTIONS,

    // State
    quote,
    transactionStatus,
    errorMessage,
    isLoadingQuote,
    balance,
    prices,
    loadingMessage,

    // Actions
    swapTokens,
    handleMaxAmount,
    handlePercentage,
    executeSwap: executeSwapTransaction,
    resetTransaction,
    updateBalance,

    // Status
    isAuthenticated: authenticated,
    walletAddress,
  };
};
