// hooks/useSwap.ts
import { useState, useCallback, useEffect } from "react";
import { Token, TransactionStatus, SwapQuote, UseSwapReturn } from "@/types/swap.types";
import { pancakeSwapService } from "@/services/pancakeswap.service";
import { priceService } from "@/services/price.service";
import { DEFAULT_SLIPPAGE, TOKENS } from "@/constants/tokens";
import { usePrivy } from "@privy-io/react-auth";
import { BrowserProvider, ethers } from "ethers";
import { errorLogger } from "@/utils/errorLogger";

export const useSwap = (): UseSwapReturn => {
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ Error fetching quote:", errorMsg);
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
      const executionStartTime = Date.now();
      console.log("🚀 [SWAP] ========== SWAP EXECUTION START ==========");
      console.log(`⏱️  [SWAP] Timestamp: ${new Date().toISOString()}`);
      console.log("🚀 [SWAP] executeSwap called with:", { walletAddress, sellAmount, sellToken: sellToken.symbol, receiveToken: receiveToken.symbol });
      console.log("📦 [SWAP] Full token objects:", { sellToken, receiveToken });
      
      if (!sellAmount || parseFloat(sellAmount) === 0) {
        console.error("❌ [SWAP] VALIDATION FAILED: No sell amount provided");
        setErrorMessage("Please enter an amount to swap");
        setTransactionStatus("error");
        return;
      }
      
      // Validate amount is not too small
      const sellAmountNum = parseFloat(sellAmount);
      if (sellToken.symbol === "BNB" && sellAmountNum < 0.001) {
        console.warn("⚠️ [SWAP] WARNING: Swap amount is very small (< 0.001 BNB)");
        console.warn("   This may fail due to minimum output amounts and slippage");
        console.warn("   Try increasing the amount to at least 0.01 BNB");
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
          fromNativeBNB: sellToken.symbol === "BNB",  // ⭐ Use native BNB if user selected BNB
        };
        
        console.log("📤 Sending to /api/pancakeswap/prepare-swap:", preparePayload);
        console.log("⚠️  CRITICAL: Verify these addresses exist on BSC mainnet:");
        console.log(`   → Input (${sellToken.symbol}): ${sellToken.address}`);
        console.log(`   → Output (${receiveToken.symbol}): ${receiveToken.address}`);
        
        // Additional validation for known issues
        const lexaExpectedAddress = "0x6fc20e595A8704725DBd160E7c799665706e0bdD";
        const wbnbExpectedAddress = "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c";
        
        if (sellToken.symbol === "LEXA" && sellToken.address.toLowerCase() !== lexaExpectedAddress.toLowerCase()) {
          console.warn(`⚠️  WARNING: LEXA address mismatch!`);
          console.warn(`   Expected: ${lexaExpectedAddress}`);
          console.warn(`   Got:      ${sellToken.address}`);
        }
        
        if (receiveToken.symbol === "BNB" && receiveToken.address.toLowerCase() !== wbnbExpectedAddress.toLowerCase()) {
          console.warn(`⚠️  WARNING: BNB/WBNB address mismatch!`);
          console.warn(`   Expected: ${wbnbExpectedAddress}`);
          console.warn(`   Got:      ${receiveToken.address}`);
        }
        
        if (sellToken.symbol === "BNB" && sellToken.address.toLowerCase() !== wbnbExpectedAddress.toLowerCase()) {
          console.warn(`⚠️  WARNING: BNB/WBNB address mismatch!`);
          console.warn(`   Expected: ${wbnbExpectedAddress}`);
          console.warn(`   Got:      ${sellToken.address}`);
        }
        
        if (receiveToken.symbol === "LEXA" && receiveToken.address.toLowerCase() !== lexaExpectedAddress.toLowerCase()) {
          console.warn(`⚠️  WARNING: LEXA address mismatch!`);
          console.warn(`   Expected: ${lexaExpectedAddress}`);
          console.warn(`   Got:      ${receiveToken.address}`);
        }
        
        // Validate addresses before sending - check format (0x + 40 hex chars)
        const isValidAddress = (addr: string | undefined) => {
          if (!addr) return false;
          return /^0x[a-fA-F0-9]{40}$/.test(addr);
        };
        
        if (!isValidAddress(sellToken.address)) {
          console.error("❌ [SWAP] Invalid sell token address:", sellToken.address);
          console.error("   Token object:", sellToken);
          console.error("   Address type:", typeof sellToken.address);
          console.error("   Address is undefined:", sellToken.address === undefined);
          console.error("   Address is null:", sellToken.address === null);
          throw new Error(`Invalid sell token address: ${sellToken.address}`);
        }
        if (!isValidAddress(receiveToken.address)) {
          console.error("❌ [SWAP] Invalid receive token address:", receiveToken.address);
          console.error("   Token object:", receiveToken);
          console.error("   Address type:", typeof receiveToken.address);
          throw new Error(`Invalid receive token address: ${receiveToken.address}`);
        }
        console.log("✓ Token addresses are valid");
        
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
        
        // Detect swap type and log important details
        const WBNB_ADDRESS = "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c";
        const isBNBInput = sellToken.symbol === "BNB";  // Native BNB, not WBNB token
        const isBNBOutput = receiveToken.symbol === "BNB";
        
        let swapType = "UNKNOWN";
        if (isBNBInput) {
          swapType = "NATIVE BNB → LEXA (router wraps BNB→WBNB then swaps)";
        } else if (isBNBOutput) {
          swapType = "LEXA → NATIVE BNB (swaps then unwraps WBNB→BNB)";
        } else {
          swapType = "TOKEN TO TOKEN (direct swap)";
        }
        console.log("🔄 [SWAP] Swap Type:", swapType);
        if (isBNBInput) {
          console.log("💰 [SWAP] Native BNB Wrapping:");
          console.log("   1. Router receives native BNB as transaction value");
          console.log("   2. Router deposits BNB → WBNB internally via deposit()");
          console.log("   3. Router swaps WBNB → LEXA");
          console.log("   4. LEXA tokens sent to wallet");
        }
        console.log("💰 [SWAP] Transaction Value to Send:", preparedSwap.swap?.value, "wei", isBNBInput ? "(native BNB)" : "(0 for token swaps)");
        
        // Log detailed swap information
        console.log("📋 [SWAP] Prepared Swap Details:");
        console.log("  Input Token:", sellToken.symbol, "at", sellToken.address);
        console.log("  Output Token:", receiveToken.symbol, "at", receiveToken.address);
        console.log("  Amount In:", sellAmount, sellToken.symbol);
        console.log("  Minimum Out:", preparedSwap.details?.minimumAmountOut, receiveToken.symbol);
        console.log("  Slippage:", slippage === "custom" ? customSlippage : slippage, "%");
        console.log("  Deadline:", new Date(preparedSwap.details?.deadline * 1000).toISOString());
        console.log("  Price Impact:", preparedSwap.details?.priceImpact);
        console.log("  Expected Out:", preparedSwap.details?.amountOut, receiveToken.symbol);
        
        // Check if output amount seems reasonable
        const expectedOutNum = parseFloat(preparedSwap.details?.amountOut || "0");
        const minimumOutNum = parseFloat(preparedSwap.details?.minimumAmountOut || "0");
        if (expectedOutNum > 1000) {
          console.warn("⚠️  WARNING: Expected output is very high (>1000 tokens)");
          console.warn("   This may indicate:");
          console.warn("   - Wrong pool pair");
          console.warn("   - Incorrect token address");
          console.warn("   - Pool with very low liquidity");
        }

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
          console.error("❌ [SWAP] Full error object:", JSON.stringify(signerError, null, 2));
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

        // ========== STEP 4: PRE-FLIGHT CHECKS ==========
        console.log("=".repeat(50));
        console.log("STEP 4: Pre-flight checks...");
        console.log("=".repeat(50));
        
        try {
          // Check signer balance
          const signerBalance = await provider.getBalance(walletAddress);
          const signerBalanceEth = ethers.formatEther(signerBalance);
          console.log(`💰 Signer BNB balance: ${signerBalanceEth} BNB`);
          
          // Check if we have enough balance (swap amount + gas estimate buffer)
          const swapAmountBN = ethers.parseEther(sellAmount);
          const gasEstimateBN = ethers.parseEther("0.0008"); // Assume ~0.0008 BNB gas fee
          const totalNeededBN = swapAmountBN + gasEstimateBN;
          
          if (signerBalance < totalNeededBN) {
            const deficit = ethers.formatEther(totalNeededBN - signerBalance);
            console.warn("⚠️  WARNING: Insufficient BNB balance!");
            console.warn(`   Current balance: ${signerBalanceEth} BNB`);
            console.warn(`   Swap amount: ${sellAmount} BNB`);
            console.warn(`   Est. gas fee: 0.0008 BNB`);
            console.warn(`   Total needed: ${ethers.formatEther(totalNeededBN)} BNB`);
            console.warn(`   Deficit: ${deficit} BNB`);
            console.warn(`   👉 ADD MORE BNB TO YOUR WALLET FIRST!`);
          }
          
          if (signerBalance < ethers.parseEther("0.001")) {
            console.warn("⚠️ WARNING: Very low BNB balance, may fail for gas!");
          }

          // Estimate gas for the swap transaction (if no approval needed and no wrap needed)
          // Skip gas estimation for native BNB swaps because wrap must happen first
          if (!preparedSwap.approval && !preparedSwap.wrap) {
            console.log("📊 Estimating gas for swap transaction...");
            try {
              const gasEstimate = await provider.estimateGas({
                to: preparedSwap.swap.to,
                data: preparedSwap.swap.data,
                value: preparedSwap.swap.value,
                from: walletAddress,
              });
              console.log(`✓ Gas estimate: ${gasEstimate.toString()} units`);
              console.log(`✓ Gas estimate breakdown: ${(Number(gasEstimate) / 1e6).toFixed(2)}M units`);
            } catch (gasError: any) {
              const gasErrorMsg = gasError instanceof Error ? gasError.message : String(gasError);
              console.warn("⚠️ Gas estimation failed (continuing anyway):", gasErrorMsg);
              
              if (gasErrorMsg.toLowerCase().includes("reverted") || gasErrorMsg.toLowerCase().includes("require(false)") || gasErrorMsg.toLowerCase().includes("transfer")) {
                console.error("❌ [SWAP] Transaction WILL FAIL when executed!");
                console.error("❌ [SWAP] Root cause: PancakeSwap router rejected the swap parameters");
                console.error("❌ [SWAP] This usually means one of:");
                console.error("   1. 💰 INSUFFICIENT BNB - You need BNB for both swap + gas fees");
                console.error(`      Try adding 0.005+ BNB to your wallet and retry`);
                console.error("   2. Slippage too low - increase to 2-5% and try again");
                console.error("   3. Insufficient liquidity - try a smaller amount");
                console.error("   4. Pool may be inactive - check if pair exists on PancakeSwap");
                console.error("   5. ❌ WRONG TOKEN ADDRESSES - verify the token addresses:");
                console.error(`      - Sell Token (${sellToken.symbol}): ${sellToken.address}`);
                console.error(`      - Receive Token (${receiveToken.symbol}): ${receiveToken.address}`);
                console.error(`      - WBNB reference address: ${WBNB_ADDRESS}`);
                console.error("   6. ⚠️  CRITICAL: The token pair might not exist on PancakeSwap");
                console.error(`      Check if a pool exists for: ${sellToken.address.substring(0,14)}... <→> ${receiveToken.address.substring(0,14)}...`);
                console.error("   7. Token tax/transfer restrictions - Some tokens have fees that break swaps");
                console.error("   8. Transaction timing - try again in a moment");
                console.error("");
                console.error("Full error from gas estimation:", gasError);
                
                // Extract more details if available
                if (gasError?.data) {
                  console.error("Error data:", gasError.data);
                }
                if (gasError?.transaction) {
                  console.error("Transaction that would have failed:", {
                    to: gasError.transaction.to,
                    from: gasError.transaction.from,
                    data: gasError.transaction.data?.substring(0, 100) + "...",
                  });
                }
                
                // Build more helpful error message based on available info
                let userMessage = "❌ Swap cannot proceed. "
                
                // Check if amount is very small
                const sellAmountNum = parseFloat(sellAmount);
                if (sellToken.symbol === "BNB" && sellAmountNum < 0.005) {
                  userMessage += "Your BNB amount is very small (< 0.005 BNB). Try using at least 0.01 BNB.";
                } else if (slippage === "custom" && parseFloat(customSlippage) < 1) {
                  userMessage += "Your slippage is very low. Try increasing to 2-5%.";
                } else {
                  userMessage += "Try: (1) Increase slippage to 2-5%, (2) Use a larger amount, (3) Check LEXA address is correct.";
                }
                
                userMessage += " Check console for full error details.";
                setErrorMessage(userMessage);
                setTransactionStatus("error");
                return;
              }
            }
          } else if (preparedSwap.wrap) {
            console.log("⏭️  Skipping gas estimation - wrap transaction must execute first");
            console.log("ℹ️  Will estimate gas AFTER wrap + approval completes");
          }
        } catch (preflight) {
          console.warn("⚠️ Pre-flight check warning:", preflight);
        }

        // ========== STEP 5: EXECUTE WRAP (IF NEEDED FOR NATIVE BNB) ==========
        if (preparedSwap.wrap) {
          console.log("=".repeat(50));
          console.log("STEP 5: Wrapping native BNB → WBNB...");
          console.log("=".repeat(50));
          console.log("📝 Wrap TX Details:");
          console.log("  To (WBNB):", preparedSwap.wrap.to);
          console.log("  Value (native BNB):", ethers.formatEther(preparedSwap.wrap.value), "BNB");
          console.log("  Function: WBNB.deposit()");
          
          try {
            console.log("🔐 Sending wrap transaction - PLEASE CONFIRM IN YOUR WALLET");
            console.log("⏲️  Awaiting wallet response...");
            
            let wrapTxResponse;
            try {
              wrapTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.wrap.to.toLowerCase()),
                data: preparedSwap.wrap.data,
                value: preparedSwap.wrap.value,
                gasLimit: "100000",
              });
            } catch (sendError: any) {
              console.error("❌ [SWAP] Wallet rejection on wrap:");
              errorLogger.logError(sendError, {
                component: "SWAP_WRAP",
                action: "sendTransaction",
                walletAddress,
                chainId: "0x38",
                timestamp: new Date().toISOString(),
              });
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("You rejected the wrap transaction");
              } else {
                setErrorMessage(`Wrap failed: ${sendError?.message || String(sendError)}`);
              }
              
              setTransactionStatus("error");
              return;
            }
            
            console.log("✓ Wrap sent, TX hash:", wrapTxResponse.hash);
            console.log("⏳ Waiting for wrap confirmation...");
            
            try {
              const wrapReceipt = await wrapTxResponse.wait(1);
              
              if (!wrapReceipt || wrapReceipt.status === 0) {
                throw new Error("Wrap transaction failed on-chain");
              }

              console.log("✓✓✓ Wrap confirmed! Native BNB successfully wrapped to WBNB");
              console.log("    Hash:", wrapReceipt.hash);
            } catch (waitError) {
              console.error("❌ Wrap wait error:", waitError);
              setErrorMessage("Wrap transaction failed");
              setTransactionStatus("error");
              return;
            }
          } catch (wrapError) {
            const errorMsg = wrapError instanceof Error ? wrapError.message : String(wrapError);
            console.error("❌ Wrap error:", errorMsg);
            setErrorMessage(`Wrap failed: ${errorMsg}`);
            setTransactionStatus("error");
            return;
          }
        }

        // ========== STEP 6: EXECUTE APPROVAL (IF NEEDED) ==========
        if (preparedSwap.approval) {
          console.log("=".repeat(50));
          console.log("STEP 5: Requesting token approval...");
          console.log("=".repeat(50));
          console.log("📝 Approval TX Details:");
          console.log("  To:", preparedSwap.approval.to);
          console.log("  Data length:", preparedSwap.approval.data.length);
          
          try {
            console.log("🔐 Sending approval to wallet - PLEASE CONFIRM IN YOUR WALLET");
            console.log("⏲️  Awaiting wallet response...");
            
            let approveTxResponse;
            try {
              approveTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.approval.to.toLowerCase()),
                data: preparedSwap.approval.data,
                gasLimit: "100000",
              });
            } catch (sendError: any) {
              console.error("❌ [SWAP] Wallet rejection or signing error on approval:");
              errorLogger.logError(sendError, {
                component: "SWAP_APPROVAL",
                action: "sendTransaction",
                walletAddress,
                chainId: "0x38",
                timestamp: new Date().toISOString(),
              });
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("You rejected the approval request");
              } else if (sendError?.message?.toLowerCase().includes("user denied")) {
                setErrorMessage("You rejected the approval request");
              } else if (sendError?.message?.toLowerCase().includes("insufficient")) {
                setErrorMessage("Insufficient balance for approval");
              } else {
                setErrorMessage(`Approval failed: ${sendError?.message || String(sendError)}`);
              }
              
              setTransactionStatus("error");
              return;
            }
            
            console.log("✓ Approval sent (awaiting from signer), TX object:", approveTxResponse);
            
            if (!approveTxResponse || !approveTxResponse.hash) {
              throw new Error("No transaction hash returned from approval");
            }
            
            console.log("✓ Approval TX hash:", approveTxResponse.hash);
            console.log("⏳ Waiting for approval confirmation...");
            
            try {
              const approveReceipt = await approveTxResponse.wait(1);
              
              if (!approveReceipt) {
                throw new Error("No approval receipt received after waiting");
              }

              console.log("✓ Approval receipt received, status:", approveReceipt.status);
              
              if (approveReceipt.status === 0) {
                throw new Error("Approval transaction failed on-chain");
              }
              
              console.log("✓ Approval confirmed. Hash:", approveReceipt.hash);
            } catch (waitError) {
              console.error("❌ [SWAP] Error waiting for approval receipt:", waitError);
              throw waitError;
            }
          } catch (approvalError) {
            const errorMsg = approvalError instanceof Error ? approvalError.message : String(approvalError);
            console.error("❌ Approval error:", errorMsg);
            console.error("❌ Full approval error object:", approvalError);
            
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

        // ========== STEP 7: APPROVE WBNB SPENDING (IF NEEDED AFTER WRAP) ==========
        if (preparedSwap.wrapApproval) {
          console.log("=".repeat(50));
          console.log("STEP 7: Approving WBNB spending by router...");
          console.log("=".repeat(50));
          console.log("📝 WBNB Approval TX Details:");
          console.log("  To (WBNB):", preparedSwap.wrapApproval.to);
          console.log("  Function: WBNB.approve(router, amount)");
          console.log("  Data:", preparedSwap.wrapApproval.data.substring(0, 50) + "...");
          
          try {
            console.log("🔐 Sending approval - PLEASE CONFIRM IN YOUR WALLET");
            console.log("⏲️  Awaiting wallet response...");
            
            let approvalTxResponse;
            try {
              approvalTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.wrapApproval.to.toLowerCase()),
                data: preparedSwap.wrapApproval.data,
                value: preparedSwap.wrapApproval.value,
                gasLimit: "100000",
              });
            } catch (sendError: any) {
              console.error("❌ [SWAP] Wallet rejection or signing error on WBNB approval:");
              errorLogger.logError(sendError, {
                component: "SWAP_WRAP_APPROVAL",
                action: "sendTransaction",
                walletAddress,
                chainId: "0x38",
                timestamp: new Date().toISOString(),
              });
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("You rejected the WBNB approval");
              } else {
                setErrorMessage(`WBNB approval failed: ${sendError?.message || String(sendError)}`);
              }
              
              setTransactionStatus("error");
              return;
            }
            
            console.log("✓ Approval sent, TX hash:", approvalTxResponse.hash);
            console.log("⏳ Waiting for approval confirmation...");
            
            try {
              const approvalReceipt = await approvalTxResponse.wait(1);
              
              if (!approvalReceipt) {
                throw new Error("No approval receipt received after waiting");
              }

              console.log("✓ WBNB approval confirmed! Hash:", approvalReceipt.hash);
              
              if (approvalReceipt.status === 0) {
                throw new Error("WBNB approval transaction failed on-chain");
              }
            } catch (waitError) {
              console.error("❌ [SWAP] Error waiting for approval receipt:", waitError);
              throw waitError;
            }
          } catch (approvalError) {
            const errorMsg = approvalError instanceof Error ? approvalError.message : String(approvalError);
            console.error("❌ WBNB approval error:", errorMsg);
            
            setErrorMessage(`WBNB approval failed: ${errorMsg}`);
            setTransactionStatus("error");
            return;
          }
        }

        // ========== STEP 8: EXECUTE SWAP ==========
        console.log("=".repeat(50));
        const stepNum = preparedSwap.wrap ? (preparedSwap.wrapApproval ? "8" : "7") : "6";
        console.log(`STEP ${stepNum}: Executing swap transaction...`);
        console.log("=".repeat(50));
        console.log("📝 Swap TX Details:");
        console.log("  To (Router):", preparedSwap.swap.to);
        console.log("  Value (BNB):", preparedSwap.swap.value);
        console.log("  Data length:", preparedSwap.swap.data.length);
        console.log("  Min output:", preparedSwap.details.minimumAmountOut);
        console.log("  Deadline:", new Date(preparedSwap.details.deadline * 1000).toISOString());
        console.log("📋 Full swap data (first 100 chars):", preparedSwap.swap.data.substring(0, 100));
        
        try {
          console.log("🔐 Sending swap to wallet - PLEASE CONFIRM IN YOUR WALLET");
          console.log("⏲️  Awaiting wallet response (this may take a moment)...");
          console.log("⚠️  If wallet rejects, check for error messages in this console output");
          
          // Estimate gas before sending
          try {
            console.log("⛽ Estimating gas for swap transaction...");
            const gasEstimate = await provider.estimateGas({
              to: ethers.getAddress(preparedSwap.swap.to.toLowerCase()),
              data: preparedSwap.swap.data,
              value: preparedSwap.swap.value,
              from: walletAddress,
            });
            console.log("✓ Gas estimate successful:", gasEstimate.toString());
            console.log("  Using fixed gas limit: 500000 (estimate:", gasEstimate.toString(), ")");
          } catch (gasError: any) {
            console.warn("⚠️  Gas estimation failed, but continuing with fixed limit:", gasError?.message);
            console.error("💡 This might indicate the swap will fail. Common causes:");
            console.error("   1. WBNB not properly approved to router");
            console.error("   2. Insufficient wrapped BNB balance");
            console.error("   3. Slippage too tight (try increasing to 8-10%)");
            console.error("   4. Swap path issue");
          }
          
          let swapTxResponse;
          try {
              console.log("✋ Wallet is processing transaction - check MetaMask...");
              swapTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.swap.to.toLowerCase()),
                data: preparedSwap.swap.data,
                value: preparedSwap.swap.value,
                gasLimit: "500000",
              });
              console.log("✅ Wallet accepted transaction");
            } catch (sendError: any) {
              console.error("❌ [SWAP] WALLET REJECTED - Wallet rejection or signing error on swap:");
              console.error("❌ Error code:", sendError?.code);
              console.error("❌ Error message:", sendError?.message);
              console.error("❌ Full error:", sendError);
              errorLogger.logError(sendError, {
                component: "SWAP_EXECUTION",
                action: "sendTransaction",
                walletAddress,
                chainId: "0x38",
                timestamp: new Date().toISOString(),
                additionalInfo: {
                  sellToken: sellToken.symbol,
                  receiveToken: receiveToken.symbol,
                  sellAmount,
                },
              });
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("❌ You rejected the swap transaction. Check console for details.");
              } else if (sendError?.message?.toLowerCase().includes("user denied")) {
                setErrorMessage("❌ You rejected the swap transaction. Check console for details.");
              } else if (sendError?.message?.toLowerCase().includes("insufficient")) {
                setErrorMessage("❌ Insufficient balance or liquidity. Check console for details.");
              } else if (sendError?.message?.toLowerCase().includes("reverted")) {
                setErrorMessage("❌ Transaction reverted - likely slippage or liquidity issue. Check console for details.");
              } else {
                setErrorMessage(`❌ Swap failed: ${sendError?.message || String(sendError)}. Check console for full error.`);
              }
              
              setTransactionStatus("error");
              return;
            }
          
          if (!swapTxResponse) {
            throw new Error("No transaction response from signer");
          }

          console.log("✓ Swap sent, TX object:", swapTxResponse);
          console.log("✓ Swap TX hash:", swapTxResponse.hash);
          console.log("⏳ Waiting for swap confirmation (up to 2 minutes)...");
          
          let swapReceipt;
          try {
            swapReceipt = await Promise.race([
              swapTxResponse.wait(1),
              new Promise<null>((_, reject) =>
                setTimeout(() => {
                  console.error("❌ [SWAP] TIMEOUT: Transaction confirmation took too long (> 1min)");
                  console.error(`📊 Check status on BSCscan: https://bscscan.com/tx/${swapTxResponse.hash}`);
                  reject(new Error(`Confirmation timeout (1min+) - transaction may still be pending. Hash: ${swapTxResponse.hash}`));
                }, 60000)
              ),
            ]);
          } catch (waitError) {
            console.error("❌ [SWAP] Error waiting for receipt:", waitError);
            // Still report to user but don't fail completely
            if (waitError instanceof Error && waitError.message.includes("Confirmation timeout")) {
              console.warn("⚠️  Transaction may still be confirming on-chain. Check BSCscan for status.");
            }
            throw waitError;
          }
          
          console.log("✓ Receipt object:", swapReceipt);
          
          if (!swapReceipt) {
            throw new Error("No receipt received");
          }
          
          console.log("✓ Receipt status:", swapReceipt.status);
          console.log("✓ Receipt hash:", swapReceipt.hash);
          
          if (swapReceipt.status === 0) {
            console.error("❌ [SWAP] Receipt status is 0 (FAILED)");
            throw new Error("Transaction failed on-chain - try increasing slippage");
          }
          
          console.log("✓✓ SWAP SUCCESSFUL! TX Hash:", swapReceipt.hash);
          console.log(`⏱️  [SWAP] Total execution time: ${Date.now() - executionStartTime}ms`);
          setTransactionStatus("success");
          setSellAmount("");
          setReceiveAmount("");
          setQuote(null);
        } catch (swapError) {
          const errorMsg = swapError instanceof Error ? swapError.message : String(swapError);
          console.error("❌ Swap execution error:", errorMsg);
          console.error("❌ Full swap error object:", JSON.stringify(swapError, null, 2));
          
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ [SWAP] ========== CRITICAL ERROR ==========");
        console.error("Error details:", errorMsg);
        console.error("Full error object:", JSON.stringify(error, null, 2));
        console.error("Error type:", typeof error);
        if (error instanceof Error) {
          console.error("Error stack:", error.stack);
        }
        console.log("=".repeat(50));
        
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
