// hooks/useSwap.ts
import { useState, useCallback, useEffect } from "react";
import { Token, TransactionStatus, SwapQuote } from "@/types/swap.types";
import { pancakeSwapService } from "@/services/pancakeswap.service";
import { priceService } from "@/services/price.service";
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
  const [prices, setPrices] = useState<{ bnb: number; lexa: number }>({
    bnb: 0,
    lexa: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        // Display the minimum amount (after slippage) as what user will actually receive
        setReceiveAmount(quoteData.minimumAmountOut);
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

  // Fetch prices on mount and periodically
  useEffect(() => {
    const fetchPrices = async () => {
      const priceData = await priceService.getPrices();
      setPrices({
        bnb: priceData.bnb,
        lexa: priceData.lexa,
      });
    };

    fetchPrices();

    // Update prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

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

        console.log("🔄 Preparing swap transaction...");
        // Prepare swap transaction
        const preparedSwap = await pancakeSwapService.prepareSwapTransaction({
          tokenIn: sellToken.address,
          tokenOut: receiveToken.address,
          amountIn: sellAmount,
          slippage: parseFloat(effectiveSlippage),
          walletAddress,
        });

        console.log("✓ Swap prepared:", {
          approval: !!preparedSwap.approval,
          swap: preparedSwap.swap,
        });

        // Get the signer from Privy
        const provider = new BrowserProvider(window.ethereum!);
        const signer = await provider.getSigner();

        // Execute approval transaction if needed
        if (preparedSwap.approval) {
          console.log("🔐 Requesting wallet approval for token spending...");
          const approveTx = {
            to: preparedSwap.approval.to,
            data: preparedSwap.approval.data,
          };

          try {
            console.log("📊 Using fixed gas limit for approval (50k is typical for ERC20 approve)...");

            const approveTxWithGas = {
              ...approveTx,
              gasLimit: "100000", // Fixed limit for ERC20 approve
            };

            console.log("📤 Sending approval transaction - please confirm in wallet...");
            const approveTxResponse = await signer.sendTransaction(approveTxWithGas);
            console.log("✓ Approval transaction sent:", approveTxResponse.hash);

            console.log("⏳ Waiting for approval confirmation on blockchain...");
            const approveReceipt = await approveTxResponse.wait(1); // Wait for 1 block confirmation
            
            if (!approveReceipt || approveReceipt.status === 0) {
              throw new Error("Approval transaction failed on blockchain");
            }
            console.log("✓✓ Approval confirmed:", approveReceipt.hash);
          } catch (approvalError) {
            console.error("❌ Approval failed:", approvalError);
            const approvalErrorMsg = approvalError instanceof Error 
              ? approvalError.message 
              : String(approvalError);
            
            let userFriendlyError = approvalErrorMsg;
            if (approvalErrorMsg.toLowerCase().includes("user rejected")) {
              userFriendlyError = "You rejected the token approval in your wallet";
            } else if (approvalErrorMsg.toLowerCase().includes("insufficient")) {
              userFriendlyError = "Insufficient balance for approval";
            }
            
            setErrorMessage(userFriendlyError);
            setTransactionStatus("error");
            return; // Don't proceed if approval fails
          }
        }

        // Execute swap transaction
        console.log("🔄 Requesting wallet confirmation for swap...");
        
        // Validate wallet connection
        if (!user?.wallet?.address) {
          throw new Error("Wallet not connected. Please connect your wallet.");
        }

        // Prepare fresh swap transaction with updated deadline
        // (original deadline might have expired during approval/wallet prompts)
        console.log("📋 Re-preparing swap with fresh deadline...");
        const freshPrepareRes = await fetch("/api/pancakeswap/prepare-swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenIn: sellToken.address,
            tokenOut: receiveToken.address,
            amountIn: sellAmount,
            slippage: customSlippage || slippage,
            walletAddress: user.wallet.address,
          }),
        });

        console.log("📤 Prepared swap request with:", {
          tokenIn: sellToken.address,
          tokenOut: receiveToken.address,
          amountIn: sellAmount,
          slippage: customSlippage || slippage,
          slippageType: typeof (customSlippage || slippage),
          walletAddress: user.wallet.address?.substring(0, 14) + "...",
        });

        if (!freshPrepareRes.ok) {
          const errorData = await freshPrepareRes.json();
          console.error("❌ API error response:", errorData);
          throw new Error(
            `Failed to prepare swap: ${errorData.error || freshPrepareRes.statusText}`
          );
        }

        const freshPreparedSwap = await freshPrepareRes.json();

        if (!freshPreparedSwap.swap) {
          throw new Error("Failed to re-prepare swap transaction");
        }

        // Import ethers to access getAddress for checksumming
        const { ethers } = await import("ethers");

        // Ensure all addresses are properly checksummed
        const checksummedTo = ethers.getAddress(freshPreparedSwap.swap.to);

        const swapTx = {
          to: checksummedTo,
          data: freshPreparedSwap.swap.data,
          value: freshPreparedSwap.swap.value,
          from: user.wallet.address, // Explicitly set the sender
        };

        // Check deadline is still valid before gas estimation
        const currentTime = Math.floor(Date.now() / 1000);
        const deadline = freshPreparedSwap.details?.deadline;
        if (deadline && currentTime > deadline) {
          throw new Error("Swap deadline has expired. Please try again.");
        }
        if (deadline && currentTime > deadline - 60) {
          console.warn("⚠️ Deadline is less than 1 minute away - transaction might fail");
        }

        console.log(
          `📊 Transaction details: amountOut=${freshPreparedSwap.details?.amountOut}, minimumOut=${freshPreparedSwap.details?.minimumAmountOut}, deadline=${deadline} (${Math.floor((deadline - currentTime) / 60)} min remaining)`
        );

        try {
          console.log("📊 Skipping gas estimation (causes false failures), using fixed gas limit...");
          
          // Use a fixed reasonable gas limit for DEX swaps instead of estimating
          // Gas estimation simulation can fail even if the transaction would succeed on-chain
          // DEX swaps typically use 150k-300k gas; we use 500k to be safe
          const gasLimit = "500000";

          // Get current gas price from provider for BSC
          console.log("⛽ Fetching current gas price from network...");
          const feeData = await provider.getFeeData();
          const gasPrice = feeData?.gasPrice?.toString() || "1000000000"; // Default to 1 gwei if unavailable
          console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

          const txWithGas = {
            ...swapTx,
            gasLimit,
            gasPrice,
            chainId: 56, // BSC MainNet
          };

          console.log("✓ Final transaction to send:", {
            to: txWithGas.to,
            from: txWithGas.from,
            value: txWithGas.value,
            gasLimit: txWithGas.gasLimit,
            gasPrice: ethers.formatUnits(BigInt(gasPrice), "gwei"),
            chainId: txWithGas.chainId,
            data: txWithGas.data?.substring(0, 100) + "...",
            dataLength: txWithGas.data?.length,
          });

          console.log("📋 Swap details breakdown:", {
            amountOut: freshPreparedSwap.details?.amountOut,
            minimumAmountOut: freshPreparedSwap.details?.minimumAmountOut,
            path: freshPreparedSwap.details?.path,
            deadline: freshPreparedSwap.details?.deadline,
            slippage: `${(100 - (parseFloat(freshPreparedSwap.details?.minimumAmountOut || "0") / parseFloat(freshPreparedSwap.details?.amountOut || "1") * 100)).toFixed(2)}%`,
          });

          // Verify we're on the correct network (BSC MainNet = chainId 56)
          const network = await provider.getNetwork();
          console.log(`🌐 Connected network: ${network.name} (chainId: ${network.chainId})`);
          if (network.chainId !== BigInt(56)) {
            throw new Error(`Wrong network! Your wallet is on ${network.name} (${network.chainId}), but we need BSC MainNet (56). Please switch networks in MetaMask.`);
          }

          console.log("📤 Sending swap transaction - please confirm in wallet...");
          
          let swapTxResponse;
          try {
            console.log("🔍 Raw transaction object:", {
              ...txWithGas,
              data: txWithGas.data?.substring(0, 50) + "...",
            });
            swapTxResponse = await signer.sendTransaction(txWithGas);
            console.log("✓ Swap transaction sent:", swapTxResponse.hash);
          } catch (sendError) {
            console.error("❌ Transaction rejected or failed to send:", sendError);
            const sendErrorMsg = sendError instanceof Error ? sendError.message : String(sendError);
            
            // Log full error details for debugging
            console.error("❌ Full send error:", {
              message: sendErrorMsg,
              error: sendError,
              errorType: sendError?.constructor?.name,
              errorCode: (sendError as any)?.code,
              errorData: (sendError as any)?.data,
            });
            
            let userFriendlyMsg = sendErrorMsg;
            if (sendErrorMsg.includes("user rejected") || sendErrorMsg.includes("User denied")) {
              userFriendlyMsg = "You rejected the transaction in MetaMask";
            } else if (sendErrorMsg.includes("insufficient")) {
              userFriendlyMsg = "Insufficient balance or liquidity";
            } else if (sendErrorMsg.includes("network")) {
              userFriendlyMsg = "Network error - please check your connection";
            } else if (sendErrorMsg.includes("reverted")) {
              userFriendlyMsg = "Transaction would revert - insufficient liquidity or slippage too high";
            }
            
            setErrorMessage(userFriendlyMsg);
            setTransactionStatus("error");
            return; // Exit without waiting
          }

          console.log("⏳ Waiting for swap confirmation on blockchain (1 block)...");
          
          // Wait for 1 block confirmation with 2-minute timeout
          const waitPromise = swapTxResponse.wait(1);
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Swap confirmation timeout after 2 minutes")), 120000)
          );
          
          let swapReceipt;
          try {
            swapReceipt = await Promise.race([waitPromise, timeoutPromise]);
            console.log("📋 Swap receipt received:", swapReceipt);
          } catch (waitError) {
            console.error("❌ Error during wait:", waitError);
            const waitErrorMsg = waitError instanceof Error ? waitError.message : String(waitError);
            setErrorMessage(waitErrorMsg);
            setTransactionStatus("error");
            return; // Important: don't throw, just return
          }

          if (!swapReceipt) {
            console.error("❌ No swap receipt received");
            const errorMsg = "No transaction receipt received. Please check blockchain explorer.";
            setErrorMessage(errorMsg);
            setTransactionStatus("error");
            return; // Important: don't throw, just return
          }

          if (swapReceipt.status === 0) {
            console.error("❌ Transaction reverted on-chain. Receipt:", swapReceipt);
            const errorMsg = "Swap transaction was reverted on blockchain. Try increasing slippage or reducing amount.";
            setErrorMessage(errorMsg);
            setTransactionStatus("error");
            return; // Important: don't throw, just return
          }

          console.log("✓✓ Swap successful and confirmed:", swapReceipt.hash);
          setTransactionStatus("success");
          
          // Clear amounts after successful swap
          setSellAmount("");
          setReceiveAmount("");
          setQuote(null);
        } catch (swapError) {
          console.error("❌ Swap failed:", swapError);
          console.error("❌ Full error details:", {
            message: swapError instanceof Error ? swapError.message : String(swapError),
            error: swapError,
            stack: swapError instanceof Error ? swapError.stack : undefined,
          });
          
          // Provide more helpful error messages based on error type
          let errorMessage = "Unknown swap error";
          if (swapError instanceof Error) {
            const errorStr = swapError.message.toLowerCase();
            if (errorStr.includes("reverted") || errorStr.includes("require(false)")) {
              errorMessage = "Swap reverted on-chain. This usually means:\n• Insufficient liquidity\n• Prices changed too much\n• Try increasing slippage to 15-20%\n• Or reduce the swap amount";
            } else if (errorStr.includes("user rejected")) {
              errorMessage = "Transaction cancelled by you";
            } else if (errorStr.includes("insufficient")) {
              errorMessage = "Insufficient balance or liquidity";
            } else if (errorStr.includes("deadline")) {
              errorMessage = "Transaction deadline exceeded - please try again";
            } else if (errorStr.includes("timeout")) {
              errorMessage = "Confirmation timeout - transaction may still be processing";
            } else {
              errorMessage = swapError.message;
            }
          }
          
          console.error("❌ Final error message:", errorMessage);
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error("❌ Error executing swap - outer catch:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log("Setting error state with message:", errorMsg);
        setErrorMessage(errorMsg);
        setTransactionStatus("error");
      }
    },
    [sellToken, receiveToken, sellAmount, slippage, customSlippage, user],
  );

  const resetTransaction = useCallback(() => {
    setTransactionStatus("idle");
    setErrorMessage(null);
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
    prices,
    errorMessage,

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
