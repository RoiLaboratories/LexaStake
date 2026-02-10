// hooks/useSwap.ts
import { useState, useCallback, useEffect } from "react";
import { Token, TransactionStatus, SwapQuote } from "@/types/swap.types";
import { pancakeSwapService } from "@/services/pancakeswap.service";
import { priceService } from "@/services/price.service";
import { DEFAULT_SLIPPAGE, TOKENS } from "@/constants/tokens";
import { usePrivy } from "@privy-io/react-auth";
import { BrowserProvider, ethers } from "ethers";

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
      console.log("🚀 [SWAP] ========== SWAP EXECUTION START ==========");
      console.log("🚀 [SWAP] executeSwap called with:", { walletAddress, sellAmount, sellToken: sellToken.symbol, receiveToken: receiveToken.symbol });
      
      if (!sellAmount || parseFloat(sellAmount) === 0) {
        console.error("❌ [SWAP] VALIDATION FAILED: No sell amount provided");
        setErrorMessage("Please enter an amount to swap");
        setTransactionStatus("error");
        return;
      }
      
      if (!walletAddress) {
        console.error("❌ [SWAP] VALIDATION FAILED: Wallet not connected");
        setErrorMessage("Wallet not connected");
        setTransactionStatus("error");
        return;
      }

      setTransactionStatus("loading");
      setErrorMessage(null);

      try {
        const effectiveSlippage = slippage === "custom" ? customSlippage : slippage;
        console.log("📋 [SWAP] Effective slippage: ", effectiveSlippage, "%");

        // ========== STEP 1: PREPARE SWAP TRANSACTION ==========
        console.log("=".repeat(50));
        console.log("STEP 1: Preparing swap transaction...");
        console.log("=".repeat(50));
        
        const preparePayload = {
          tokenIn: sellToken.address,
          tokenOut: receiveToken.address,
          amountIn: sellAmount,
          slippage: parseFloat(effectiveSlippage),
          walletAddress,
        };
        
        console.log("📤 Sending to /api/pancakeswap/prepare-swap:", preparePayload);
        
        const prepareRes = await fetch("/api/pancakeswap/prepare-swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preparePayload),
        });

        console.log("📬 Prepare response status:", prepareRes.status);

        if (!prepareRes.ok) {
          const errorData = await prepareRes.json();
          console.error("❌ [SWAP] API RESPONSE ERROR:", errorData);
          throw new Error(errorData.error || "Failed to prepare swap");
        }

        const preparedSwap = await prepareRes.json();
        console.log("✓ [SWAP] Swap prepared successfully:", {
          hasApproval: !!preparedSwap.approval,
          hasSwap: !!preparedSwap.swap,
          swapTarget: preparedSwap.swap?.to,
          swapDataLength: preparedSwap.swap?.data?.length,
          details: preparedSwap.details,
        });

        // ========== STEP 2: GET PROVIDER & SIGNER ==========
        console.log("=".repeat(50));
        console.log("STEP 2: Getting provider and signer from Privy...");
        console.log("=".repeat(50));
        
        if (!window.ethereum) {
          console.error("❌ [SWAP] window.ethereum NOT AVAILABLE!");
          throw new Error("Ethereum provider not available. Please ensure wallet is connected.");
        }
        
        console.log("✓ window.ethereum available");
        
        let provider;
        let signer;
        try {
          provider = new BrowserProvider(window.ethereum);
          console.log("✓ BrowserProvider created");
          
          signer = await provider.getSigner();
          console.log("✓ Signer obtained successfully");
          
          const signerAddress = await signer.getAddress();
          console.log("✓ Signer address:", signerAddress);
          
          if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            console.warn("⚠️ Signer address mismatch! Signer:", signerAddress, "Expected:", walletAddress);
          }
        } catch (signerError) {
          console.error("❌ [SWAP] SIGNER ERROR:", signerError);
          throw new Error(`Failed to get signer: ${signerError instanceof Error ? signerError.message : String(signerError)}`);
        }

        // ========== STEP 3: VERIFY NETWORK ==========
        console.log("=".repeat(50));
        console.log("STEP 3: Verifying network (BSC Mainnet)...");
        console.log("=".repeat(50));
        
        try {
          const network = await provider.getNetwork();
          console.log(`🌐 Network check: ${network.name} (ChainId: ${network.chainId})`);
          
          if (network.chainId !== BigInt(56)) {
            const errorMsg = `Wrong network! You're on ${network.name} (ChainId: ${network.chainId}), but we need BSC MainNet (ChainId: 56). Please switch in your wallet.`;
            console.error("❌ [SWAP]", errorMsg);
            setErrorMessage(errorMsg);
            setTransactionStatus("error");
            return;
          }
          console.log("✓ Correct network (BSC MainNet)");
        } catch (networkError) {
          console.warn("⚠️ Could not verify network, continuing anyway:", networkError);
        }

        // ========== STEP 4: EXECUTE APPROVAL (IF NEEDED) ==========
        if (preparedSwap.approval) {
          console.log("=".repeat(50));
          console.log("STEP 4: Requesting token approval...");
          console.log("=".repeat(50));
          console.log("📝 Approval TX Details:");
          console.log("  To:", preparedSwap.approval.to);
          console.log("  Data length:", preparedSwap.approval.data.length);
          
          try {
            console.log("🔐 Sending approval to wallet - PLEASE CONFIRM IN YOUR WALLET");
            const approveTxResponse = await signer.sendTransaction({
              to: preparedSwap.approval.to,
              data: preparedSwap.approval.data,
              gasLimit: "100000",
            });
            
            console.log("✓ Approval sent, TX hash:", approveTxResponse.hash);
            console.log("⏳ Waiting for approval confirmation...");
            
            const approveReceipt = await approveTxResponse.wait(1);
            
            if (!approveReceipt || approveReceipt.status === 0) {
              throw new Error("Approval transaction failed on-chain");
            }
            
            console.log("✓ Approval confirmed. Hash:", approveReceipt.hash);
          } catch (approvalError) {
            const errorMsg = approvalError instanceof Error ? approvalError.message : String(approvalError);
            console.error("❌ Approval error:", errorMsg);
            
            if (errorMsg.toLowerCase().includes("user rejected")) {
              setErrorMessage("You rejected the approval request");
            } else if (errorMsg.toLowerCase().includes("insufficient")) {
              setErrorMessage("Insufficient balance for approval");
            } else {
              setErrorMessage(`Approval failed: ${errorMsg}`);
            }
            
            setTransactionStatus("error");
            return;
          }
        } else {
          console.log("✓ No approval needed (BNB or already approved)");
        }

        // ========== STEP 5: EXECUTE SWAP ==========
        console.log("=".repeat(50));
        console.log("STEP 5: Executing swap transaction...");
        console.log("=".repeat(50));
        console.log("📝 Swap TX Details:");
        console.log("  To (Router):", preparedSwap.swap.to);
        console.log("  Value (BNB):", preparedSwap.swap.value);
        console.log("  Data length:", preparedSwap.swap.data.length);
        console.log("  Min output:", preparedSwap.details.minimumAmountOut);
        console.log("  Deadline:", new Date(preparedSwap.details.deadline * 1000).toISOString());
        
        try {
          console.log("🔐 Sending swap to wallet - PLEASE CONFIRM IN YOUR WALLET");
          const swapTxResponse = await signer.sendTransaction({
            to: preparedSwap.swap.to,
            data: preparedSwap.swap.data,
            value: preparedSwap.swap.value,
            gasLimit: "500000",
          });
          
          console.log("✓ Swap sent, TX hash:", swapTxResponse.hash);
          console.log("⏳ Waiting for swap confirmation (up to 2 minutes)...");
          
          const swapReceipt = await Promise.race([
            swapTxResponse.wait(1),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Confirmation timeout")), 120000)
            ),
          ]);
          
          if (!swapReceipt) {
            throw new Error("No receipt received");
          }
          
          if (swapReceipt.status === 0) {
            throw new Error("Transaction failed on-chain - try increasing slippage");
          }
          
          console.log("✓✓ SWAP SUCCESSFUL! TX Hash:", swapReceipt.hash);
          setTransactionStatus("success");
          setSellAmount("");
          setReceiveAmount("");
          setQuote(null);
        } catch (swapError) {
          const errorMsg = swapError instanceof Error ? swapError.message : String(swapError);
          console.error("❌ Swap error:", errorMsg);
          
          if (errorMsg.toLowerCase().includes("user rejected")) {
            setErrorMessage("You rejected the swap transaction");
          } else if (errorMsg.toLowerCase().includes("insufficient")) {
            setErrorMessage("Insufficient liquidity or balance");
          } else if (errorMsg.toLowerCase().includes("reverted")) {
            setErrorMessage("Swap failed - try increasing slippage tolerance");
          } else if (errorMsg.toLowerCase().includes("timeout")) {
            setErrorMessage("Transaction is pending - check your wallet");
          } else {
            setErrorMessage(errorMsg);
          }
          
          setTransactionStatus("error");
        }
      } catch (error) {
        console.error("❌ [SWAP] ========== CRITICAL ERROR ==========");
        console.error(error);
        console.log("=".repeat(50));
        
        const errorMsg = error instanceof Error ? error.message : String(error);
        setErrorMessage(errorMsg || "Unknown error occurred");
        setTransactionStatus("error");
      }
      
      console.log("🚀 [SWAP] ========== SWAP EXECUTION COMPLETE ==========\n");
    },
    [sellToken, receiveToken, sellAmount, slippage, customSlippage],
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
