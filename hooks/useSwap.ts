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
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

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
        console.log("📊 Fetching quote with:", {
          sellToken: sellToken.symbol,
          receiveToken: receiveToken.symbol,
          sellAmount,
          slippage: slippage === "custom" ? customSlippage : slippage,
        });

        const quoteData = await pancakeSwapService.getSwapQuote(
          sellToken.address,
          receiveToken.address,
          sellAmount,
          parseFloat(slippage === "custom" ? customSlippage : slippage),
        );

        console.log("✓ Quote received:", {
          amountIn: quoteData.amountIn,
          amountOut: quoteData.amountOut,
          minimumAmountOut: quoteData.minimumAmountOut,
          priceImpact: quoteData.priceImpact,
        });

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
      console.log("⚙️  [SWAP] SLIPPAGE SETTINGS IN STATE:");
      console.log("   slippage state var:", slippage);
      console.log("   customSlippage state var:", customSlippage);
      console.log("   Will use:", slippage === "custom" ? `CUSTOM ${customSlippage}%` : `PRESET ${slippage}%`);
      
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
        
        // Variable to store gas estimation from pre-flight checks
        let estimatedGasLimit: string = "500000";

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
        
        console.log("\n🌐 [API CALL] Sending prepare-swap request...");
        console.log("📤 Full payload being sent:", JSON.stringify(preparePayload, null, 2));
        
        let prepareRes;
        try {
          prepareRes = await fetch("/api/pancakeswap/prepare-swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(preparePayload),
          });
        } catch (fetchError) {
          console.error("❌ [SWAP] FETCH ERROR - Network/Connection issue:", fetchError);
          setErrorMessage(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          setTransactionStatus("error");
          return;
        }

        console.log("📬 Prepare response received - Status:", prepareRes.status, prepareRes.statusText);

        if (!prepareRes.ok) {
          let errorData;
          try {
            errorData = await prepareRes.json();
          } catch (parseError) {
            console.error("❌ [SWAP] Could not parse error response as JSON");
            setErrorMessage(`API error: ${prepareRes.statusText}`);
            setTransactionStatus("error");
            return;
          }
          console.error("❌ [SWAP] API RESPONSE ERROR:", errorData);
          
          // Check for slippage too low error
          if (errorData.error && errorData.error.includes("SLIPPAGE_TOO_LOW")) {
            console.error("⚠️  SLIPPAGE TOO LOW - User needs to increase slippage");
            setErrorMessage("❌ Slippage too low for this pair. Please increase slippage to 7% or higher and try again.");
          } else if (errorData.error && errorData.error.includes("Price impact too high")) {
            setErrorMessage("❌ Price impact too high. Try reducing amount or increasing slippage.");
          } else {
            setErrorMessage(errorData.error || "Failed to prepare swap - check console for details");
          }
          setTransactionStatus("error");
          return;
        }

        let preparedSwap;
        try {
          preparedSwap = await prepareRes.json();
        } catch (parseError) {
          console.error("❌ [SWAP] ERROR parsing successful response:", parseError);
          setErrorMessage("Failed to parse swap preparation response");
          setTransactionStatus("error");
          return;
        }
        
        console.log("✓ [SWAP] Swap prepared successfully:", {
          hasApproval: !!preparedSwap.approval,
          hasSwap: !!preparedSwap.swap,
          swapTarget: preparedSwap.swap?.to,
          swapDataLength: preparedSwap.swap?.data?.length,
          details: preparedSwap.details,
        });
        
        // 🔍 VERIFY SLIPPAGE IS BEING APPLIED
        console.log("\n🎯 [SLIPPAGE VERIFICATION]");
        console.log(`   Requested slippage: ${effectiveSlippage}%`);
        console.log(`   Expected output: ${preparedSwap.details?.amountOut} ${receiveToken.symbol}`);
        console.log(`   Minimum output (after slippage): ${preparedSwap.details?.minimumAmountOut} ${receiveToken.symbol}`);
        const expectedNum = parseFloat(preparedSwap.details?.amountOut || "0");
        const minimumNum = parseFloat(preparedSwap.details?.minimumAmountOut || "0");
        const actualSlippageApplied = ((expectedNum - minimumNum) / expectedNum * 100).toFixed(2);
        console.log(`   Actual slippage applied: ${actualSlippageApplied}%`);
        if (Math.abs(parseFloat(actualSlippageApplied) - parseFloat(effectiveSlippage)) > 0.5) {
          console.warn(`⚠️  WARNING: Applied slippage (${actualSlippageApplied}%) doesn't match requested (${effectiveSlippage}%)`);
        }
        
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
          
          const errorMsg = signerError instanceof Error ? signerError.message : String(signerError);
          
          // Check for RPC/network issues
          if (errorMsg.includes("RPC") || errorMsg.includes("endpoint") || errorMsg.includes("503") || errorMsg.includes("unavailable")) {
            const userMsg = "⚠️ Cannot reach wallet provider\n\nYour wallet's RPC provider is temporarily unavailable. This might be:\n• A temporary network issue\n• MetaMask extension problem\n• Internet connectivity issue\n\nPlease try:\n1. Refresh the page\n2. Restart MetaMask\n3. Check your internet connection\n4. Try again in a moment";
            setErrorMessage(userMsg);
            console.error(userMsg);
          } else {
            setErrorMessage(`Failed to get signer: ${errorMsg}`);
          }
          
          setTransactionStatus("error");
          return;
        }

        // ========== STEP 3: VERIFY NETWORK ==========
        console.log("=".repeat(50));
        console.log("STEP 3: Verifying network (BSC Mainnet)...");
        console.log("=".repeat(50));
        
        try {
          // Add timeout for network check (5 seconds max - RPC endpoint might be slow)
          const networkPromise = provider.getNetwork();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Network verification timeout - RPC endpoint not responding")), 5000)
          );
          
          const network = await Promise.race([networkPromise, timeoutPromise]);
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
          const errorMsg = networkError instanceof Error ? networkError.message : String(networkError);
          console.warn("⚠️ Network verification failed:", errorMsg);
          
          // Check if it's an RPC availability issue
          if (errorMsg.includes("RPC") || errorMsg.includes("endpoint") || errorMsg.includes("503") || errorMsg.includes("unavailable")) {
            console.warn("   This appears to be a network connectivity issue");
            console.warn("   Possible causes:");
            console.warn("   1. MetaMask RPC endpoint is temporarily down");
            console.warn("   2. Your internet connection is slow");
            console.warn("   3. Network is congested");
            console.warn("   Continuing with swap, but network verification failed...");
            // Don't throw - continue anyway, the swap execution will verify we're on the right chain
          } else {
            throw networkError; // Throw for non-RPC errors
          }
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
          
          // ⚠️ IMPORTANT: Different checks for BNB input vs token input
          const isBNBInput = sellToken.symbol === "BNB";
          const gasEstimateBN = ethers.parseEther("0.001"); // Typical gas fee ~0.001 BNB
          
          if (isBNBInput) {
            // For BNB input swap: Need (swap amount + gas fee)
            const swapAmountBN = ethers.parseEther(sellAmount);
            const totalNeededBN = swapAmountBN + gasEstimateBN;
            
            if (signerBalance < totalNeededBN) {
              const deficit = ethers.formatEther(totalNeededBN - signerBalance);
              console.warn("⚠️  WARNING: Insufficient BNB balance!");
              console.warn(`   Current balance: ${signerBalanceEth} BNB`);
              console.warn(`   Swap amount: ${sellAmount} BNB`);
              console.warn(`   Est. gas fee: 0.001 BNB`);
              console.warn(`   Total needed: ${ethers.formatEther(totalNeededBN)} BNB`);
              console.warn(`   Deficit: ${deficit} BNB`);
              console.warn(`   👉 ADD MORE BNB TO YOUR WALLET FIRST!`);
              throw new Error("Insufficient BNB balance for swap");
            }
          } else {
            // For token input swap (like LEXA → BNB): Only need gas fee
            console.log(`   ✓ Swapping from token (${sellToken.symbol}), checking gas balance only`);
            
            if (signerBalance < gasEstimateBN) {
              const deficit = ethers.formatEther(gasEstimateBN - signerBalance);
              console.warn("⚠️  WARNING: Insufficient BNB for gas fees!");
              console.warn(`   Current balance: ${signerBalanceEth} BNB`);
              console.warn(`   Est. gas fee: 0.001 BNB`);
              console.warn(`   Deficit: ${deficit} BNB`);
              console.warn(`   👉 ADD A SMALL AMOUNT OF BNB FOR GAS!`);
              throw new Error("Insufficient BNB balance for gas");
            }
            console.log(`   ✓ Sufficient BNB balance for gas (${signerBalanceEth} BNB)`);
          }
          
          if (signerBalance < ethers.parseEther("0.0001")) {
            console.warn("⚠️ WARNING: Very low BNB balance!");
          }

          // Estimate gas for the swap transaction BEFORE approval
          // This is a preliminary estimate - will be updated after approval is confirmed (STEP 4.5)
          // NOTE: For direct pair swaps (with transfer), skip this - tokens aren't in pair yet
          const isDirectPairSwap = !!preparedSwap.transfer;
          const shouldEstimateGas = !preparedSwap.wrap && !isDirectPairSwap;
          
          if (shouldEstimateGas) {
            console.log("📊 Attempting preliminary gas estimation (may fail if approval needed)...");
            try {
              const gasEstimate = await provider.estimateGas({
                to: preparedSwap.swap.to,
                data: preparedSwap.swap.data,
                value: preparedSwap.swap.value,
                from: walletAddress,
              });
              console.log(`✓ Gas estimate: ${gasEstimate.toString()} units`);
              console.log(`✓ Gas estimate breakdown: ${(Number(gasEstimate) / 1e6).toFixed(2)}M units`);
              
              // Apply 20% buffer for safety and save for later use in Step 6
              const gasWithBuffer = BigInt(Math.ceil(Number(gasEstimate) * 1.2));
              estimatedGasLimit = gasWithBuffer.toString();
              console.log(`✓ Gas with 20% buffer: ${estimatedGasLimit}`);
            } catch (gasError: any) {
              const gasErrorMsg = gasError instanceof Error ? gasError.message : String(gasError);
              console.warn("⚠️ Pre-approval gas estimation failed (expected for token swaps):", gasErrorMsg.substring(0, 100));
              
              if (preparedSwap.approval) {
                console.log("   This swap requires approval - gas will be estimated after approval is confirmed");
              } else {
                console.log("   Using fallback gas limit");
              }
              estimatedGasLimit = "500000";
            }
          } else if (isDirectPairSwap) {
            console.log("⏭️  Skipping gas estimation in STEP 4 for direct pair swap");
            console.log("   Tokens not yet in pair - will estimate in STEP 5.85 after transfer");
            estimatedGasLimit = "500000"; // Conservative fallback
          } else if (preparedSwap.wrap) {
            console.log("⏭️  Skipping gas estimation - wrap transaction must execute first");
            console.log("ℹ️  Will use fallback gas limit for wrap + swap");
          }
        } catch (preflight) {
          console.warn("⚠️ Pre-flight check warning:", preflight);
        }

        // ========== STEP 5: EXECUTE APPROVAL (IF NEEDED) ==========
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
              
              // Wait 2 seconds for approval to fully propagate through network
              // This prevents MetaMask simulation failures on the subsequent swap
              console.log("⏳ Waiting for approval to fully propagate...");
              await new Promise(resolve => setTimeout(resolve, 2000));
              console.log("✓ Approval propagation complete, proceeding to swap");
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
          console.log("✓ No approval needed (BNB input or already approved)");
        }

        // ========== STEP 5.5: REFRESH QUOTE (Only if approval was executed) ==========
        // For BNB swaps (no approval), the preliminary gas estimate is fresh and accurate
        // For token swaps (with approval), we need fresh quote after approval to combat K errors
        if (preparedSwap.approval) {
          console.log("=".repeat(50));
          console.log("STEP 5.5: Refreshing quote for fresh minOut (approval was executed)...");
          console.log("=".repeat(50));
          
          try {
            console.log("🔄 Re-quoting to get fresh minOut values...");
            const refreshPayload = {
              tokenIn: sellToken.address,
              tokenOut: receiveToken.address,
              amountIn: sellAmount,
              slippage: parseFloat(effectiveSlippage),
              walletAddress,
              fromNativeBNB: sellToken.symbol === "BNB",
            };
            
            const refreshRes = await fetch("/api/pancakeswap/prepare-swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(refreshPayload),
            });
            
            if (!refreshRes.ok) {
              console.warn("⚠️  Quote refresh failed, using original quote. Pancake: K risk elevated.");
              const errorData = await refreshRes.json().catch(() => ({}));
              console.warn("   Error:", errorData.error || refreshRes.statusText);
            } else {
              const refreshedSwap = await refreshRes.json();
              console.log("✓ Fresh quote received!");
              console.log(`  Original minOut: ${preparedSwap.details.minimumAmountOut}`);
              console.log(`  Refreshed minOut: ${refreshedSwap.details.minimumAmountOut}`);
              console.log(`  Current slippage: ${effectiveSlippage}%`);
              
              // Update with fresh data
              preparedSwap = refreshedSwap;
              console.log("✓ Using refreshed quote data for execution");
              
              // Log the encoded minOut in the swap data for debugging
              console.log("📋 Swap data details:");
              const minOutParam = refreshedSwap.details.minimumAmountOut;
              console.log(`   Encoded minOut in swap: ${minOutParam}`);
              console.log(`   Slippage applied: ${parseFloat(effectiveSlippage)}%`);
              console.log(`   Expected output: ${refreshedSwap.details.expectedAmountOut || "N/A"}`);
            }
          } catch (refreshError) {
            console.warn("⚠️  Quote refresh network error, using original quote:", refreshError);
          }

          // ========== STEP 5.75: RE-ESTIMATE GAS WITH FRESH DATA (after approval confirmed) ==========
          // NOTE: Skip gas estimation for direct pair swaps - will estimate after transfer is confirmed
          if (!preparedSwap.transfer) {
            console.log("=".repeat(50));
            console.log("STEP 5.75: Re-estimating gas with fresh quote (approval confirmed + pool state fresh)...");
            console.log("=".repeat(50));
            try {
              console.log("📊 Gas estimation for swap with fresh quote data...");
              
              const gasEstimate = await provider.estimateGas({
                to: preparedSwap.swap.to,
                from: walletAddress,
                data: preparedSwap.swap.data,
                value: "0",
              });
              
              const gasWithBuffer = BigInt(Math.ceil(Number(gasEstimate) * 1.2));
              estimatedGasLimit = gasWithBuffer.toString();
              
              console.log(`✓ Gas estimation successful!`);
              console.log(`   Raw estimate: ${gasEstimate.toString()}`);
              console.log(`   With 20% buffer: ${estimatedGasLimit}`);
            } catch (gasError: any) {
              const errorMsg = String(gasError.message || gasError);
              const isKError = errorMsg.toLowerCase().includes("pancake: k") || 
                              errorMsg.toLowerCase().includes("k (action");
              
              if (isKError) {
                console.warn("⚠️  Pancake K Error during gas estimation - pool liquidity instability detected");
                console.warn("   Root cause: WBNB reserve is shallow (5.09 BNB) - pool state drifting rapidly");
                console.warn("   The swap may still execute successfully on-chain despite simulation failure");
                console.log("");
                console.log("ℹ️  Strategy: Proceeding with safe fallback gas limit");
                console.log("   The blockchain will attempt execution and revert if genuinely impossible");
                estimatedGasLimit = "500000";
              } else {
                console.error("⚠️  Different gas estimation error:", errorMsg);
                console.log("   Using fallback 500000 gas");
                estimatedGasLimit = "500000";
              }
            }
          } else {
            console.log("✓ Skipping pre-transfer gas estimation for direct pair swap");
            console.log("  Will re-estimate gas in STEP 5.85 after transfer is confirmed");
            estimatedGasLimit = "300000"; // Conservative estimate for pair.swap()
          }
        } else {
          console.log("✓ No approval needed (BNB input), using preliminary gas estimate from STEP 4");
          console.log(`   Gas limit: ${estimatedGasLimit}`);
        }

        // ========== STEP 5.9: EXECUTE TRANSFER (Only for direct pair swaps) ==========
        if (preparedSwap.transfer) {
          console.log("=".repeat(50));
          console.log("STEP 5.9: Executing token transfer to pair...");
          console.log("=".repeat(50));
          console.log("📝 Transfer TX Details:");
          console.log("  To (LEXA token):", preparedSwap.transfer.to);
          console.log("  Amount:", preparedSwap.details.amountIn);
          console.log("  Recipient (pair):", "0x3027f7b11AB243A1efe3F997430fca5996276E63");
          console.log("  Function: ERC20.transfer()");
          console.log("  Data length:", preparedSwap.transfer.data.length);
          
          try {
            console.log("🔐 Sending transfer to wallet - PLEASE CONFIRM IN YOUR WALLET");
            console.log("⏲️  Awaiting wallet response...");
            
            let transferTxResponse;
            try {
              transferTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.transfer.to.toLowerCase()),
                data: preparedSwap.transfer.data,
                gasLimit: "150000", // Increased from 100k for more safety
              });
            } catch (sendError: any) {
              console.error("❌ [SWAP] Transfer wallet rejection or error:");
              console.error("   Error code:", sendError?.code);
              console.error("   Error message:", sendError?.message);
              errorLogger.logError(sendError, {
                component: "SWAP_TRANSFER",
                action: "sendTransaction",
                walletAddress,
                chainId: "0x38",
                timestamp: new Date().toISOString(),
              });
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("You rejected the transfer request");
              } else if (sendError?.message?.includes("insufficient")) {
                setErrorMessage("Insufficient LEXA balance for transfer");
              } else {
                setErrorMessage(`Transfer failed: ${sendError?.message || String(sendError)}`);
              }
              
              setTransactionStatus("error");
              return;
            }
            
            console.log("✓ Transfer sent, TX hash:", transferTxResponse.hash);
            console.log("⏳ Waiting for transfer confirmation...");
            console.log("   (This may take up to 60 seconds on BSC)");
            
            try {
              // Add timeout to prevent infinite hanging (60 seconds max)
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Transfer confirmation timeout after 60 seconds")), 60000)
              );
              
              const transferReceipt = await Promise.race([
                transferTxResponse.wait(1),
                timeoutPromise
              ]);
              
              if (!transferReceipt) {
                console.error("❌ Transfer receipt is null - transaction may have failed");
                throw new Error("Transfer receipt is null - transaction cancelled or failed");
              }
              
              console.log("✓ Transfer receipt received, checking status...");
              console.log("  Status:", transferReceipt.status);
              console.log("  Block number:", transferReceipt.blockNumber);
              
              if (transferReceipt.status === 0) {
                console.error("❌ Transfer failed on-chain with status 0");
                throw new Error("Transfer transaction failed on-chain (reverted)");
              }
              
              console.log("✓ Transfer confirmed. Hash:", transferReceipt.hash);
              console.log("  Tokens successfully sent to pair contract");
              
              // Wait 1 second for transfer to settle
              console.log("⏳ Brief wait for transfer settlement...");
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log("✓ Ready to execute swap");
              
              // ========== STEP 5.85: ESTIMATE GAS AFTER TRANSFER (for direct pair swaps) ==========
              console.log("=".repeat(50));
              console.log("STEP 5.85: Estimating gas for swap (transfer now confirmed on-chain)...");
              console.log("=".repeat(50));
              try {
                console.log("📊 Gas estimation with tokens now in pair...");
                
                const gasEstimate = await provider.estimateGas({
                  to: preparedSwap.swap.to,
                  from: walletAddress,
                  data: preparedSwap.swap.data,
                  value: "0",
                });
                
                const gasWithBuffer = BigInt(Math.ceil(Number(gasEstimate) * 1.2));
                estimatedGasLimit = gasWithBuffer.toString();
                
                console.log(`✓ Gas estimation successful!`);
                console.log(`   Raw estimate: ${gasEstimate.toString()}`);
                console.log(`   With 20% buffer: ${estimatedGasLimit}`);
              } catch (gasError: any) {
                const errorMsg = String(gasError.message || gasError);
                console.error("⚠️  Gas estimation after transfer failed:", errorMsg.substring(0, 150));
                console.log("   Using conservative fallback 500000 gas");
                estimatedGasLimit = "500000";
              }
            } catch (waitError) {
              const waitErrorMsg = waitError instanceof Error ? waitError.message : String(waitError);
              console.error("❌ Error waiting for transfer receipt:", waitErrorMsg);
              console.error("   This could mean:");
              console.error("   1. Transaction was cancelled in MetaMask");
              console.error("   2. Network connection was interrupted");
              console.error("   3. Transaction timed out (60+ seconds)");
              console.error("   4. RPC provider failed");
              
              if (waitErrorMsg.toLowerCase().includes("timeout")) {
                setErrorMessage("Transfer confirmation timed out. Please check MetaMask and try again.");
              } else if (waitErrorMsg.toLowerCase().includes("cancelled")) {
                setErrorMessage("Transfer was cancelled. Please try the swap again.");
              } else {
                setErrorMessage(`Transfer confirmation failed: ${waitErrorMsg}`);
              }
              
              setTransactionStatus("error");
              return;
            }
          } catch (transferError) {
            const errorMsg = transferError instanceof Error ? transferError.message : String(transferError);
            console.error("❌ Transfer error:", errorMsg);
            
            if (errorMsg.toLowerCase().includes("user rejected")) {
              setErrorMessage("You rejected the transfer request");
            } else {
              setErrorMessage(`Transfer failed: ${errorMsg}`);
            }
            
            setTransactionStatus("error");
            return;
          }
        } else {
          console.log("✓ No token transfer needed (Router-based swap)");
        }

        // ========== STEP 6: EXECUTE SWAP ==========
        console.log("=".repeat(50));
        console.log("STEP 6: Executing swap transaction...");
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
          
          // Use gas limit estimated with fresh quote data (after approval confirmed)
          // This uses real pool state at execution time, not stale pre-approval data
          console.log(`⚡ Using estimated gas limit from fresh quote: ${estimatedGasLimit}`);
          
          let swapTxResponse;
          try {
              console.log("✋ Wallet is processing transaction - check MetaMask...");
              console.log(`   Gas limit: ${estimatedGasLimit}`);
              
              // Parse value properly for transaction execution
              let txValue: string | number | bigint = preparedSwap.swap.value;
              if (typeof txValue === "string") {
                if (!txValue.startsWith("0x")) {
                  txValue = BigInt(txValue === "0" ? "0" : txValue);
                }
              } else if (typeof txValue === "number") {
                txValue = BigInt(txValue);
              }
              
              swapTxResponse = await signer.sendTransaction({
                to: ethers.getAddress(preparedSwap.swap.to.toLowerCase()),
                data: preparedSwap.swap.data,
                value: txValue,
                gasLimit: estimatedGasLimit,
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
              
              // Check for specific error types
              const errorMsg = sendError?.message?.toLowerCase() || "";
              const isLexaPair = sellToken.symbol === "LEXA" || receiveToken.symbol === "LEXA";
              
              if (sendError?.code === "ACTION_REJECTED" || sendError?.code === 4001) {
                setErrorMessage("❌ You rejected the swap transaction. Check console for details.");
              } else if (errorMsg.includes("pancake: k")) {
                console.error("\n🚨 PANCAKE: K ERROR - Pool x*y=k invariant cannot be satisfied");
                console.error("   The minOut you're requesting cannot be achieved at current pool state");
                console.error("   This typically happens with low-liquidity pools and tight slippage");
                
                if (isLexaPair) {
                  console.error("\n   📊 LEXA/WBNB MULTI-HOP ISSUE:");
                  console.error("   This involves a shallow WBNB reserve (5.09 BNB) in the path");
                  console.error("   Your slippage tolerance may be too tight for this route");
                  console.error("\n   ✅ SOLUTIONS TO TRY (in order):");
                  console.error("   1. INCREASE SLIPPAGE: Try 10%, 12%, or 15% instead of 7%");
                  console.error("      (Higher slippage = more flexible minOut = more likely to succeed)");
                  console.error("   2. WAIT A FEW BLOCKS: Pool state may stabilize");
                  console.error("   3. TRY A SMALLER AMOUNT: Start with 50 LEXA then retry 124");
                  console.error("   4. CONTACT SUPPORT: For persistent K errors on specific amounts");
                  setErrorMessage(`❌ K Error: Pool liquidity issue\n\nIncreasing slippage tolerance is the most likely fix:\n• Try 10-15% instead of 7%\n• This accounts for the shallow WBNB reserve\n\nIf still fails:\n• Try a smaller amount first\n• Wait a few moments and retry`);
                } else {
                  console.error("   ✅ SOLUTIONS:");
                  console.error("   1. Increase slippage tolerance to 15-20%");
                  console.error("   2. Reduce swap amount");
                  console.error("   3. Try again in a few moments");
                  setErrorMessage("❌ K Error: Insufficient liquidity\n\nTry increasing slippage to 15-20%\n\nIf still fails:\n• Reduce swap amount\n• Try again in a few moments");
                }
              } else if (errorMsg.includes("user denied")) {
                setErrorMessage("❌ You rejected the swap transaction. Check console for details.");
              } else if (errorMsg.includes("insufficient")) {
                setErrorMessage("❌ Insufficient balance or liquidity. Check console for details.");
              } else if (errorMsg.includes("reverted") || errorMsg.includes("execution reverted")) {
                setErrorMessage("❌ Transaction reverted - likely slippage, liquidity, or approval issue. Try increasing slippage.");
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
          console.log("⏳ Waiting for swap confirmation (up to 3 minutes for BSC mainnet)...");
          
          let swapReceipt;
          try {
            swapReceipt = await Promise.race([
              swapTxResponse.wait(1),
              new Promise<null>((_, reject) =>
                setTimeout(() => {
                  console.error("❌ [SWAP] TIMEOUT: Transaction confirmation took too long (> 3min)");
                  console.error(`📊 Check status on BSCscan: https://bscscan.com/tx/${swapTxResponse.hash}`);
                  reject(new Error(`Confirmation timeout (3min+) - transaction may still be pending. Hash: ${swapTxResponse.hash}`));
                }, 180000)
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
          setTransactionHash(swapReceipt.hash);
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
        
        // Detect and handle RPC/network errors with better messaging
        if (errorMsg.includes("RPC") || errorMsg.includes("endpoint") || errorMsg.includes("503") || errorMsg.includes("unavailable")) {
          const networkErrorMsg = `⚠️ Network Connection Issue\n\nCouldn't connect to the blockchain provider. This usually means:\n\n• MetaMask's RPC provider is down\n• Your internet connection is unstable\n• Network is heavily congested\n\nTry:\n1. Refresh this page\n2. Restart MetaMask\n3. Check your internet\n4. Wait a moment and try again`;
          setErrorMessage(networkErrorMsg);
          console.error("🌐 RPC/Network error detected - user should check connection");
        } else {
          setErrorMessage(errorMsg || "Unknown error occurred");
        }
        
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
    transactionHash,

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
