/**
 * MIGRATION GUIDE: Integrating useSwapEnhanced into Existing Components
 * 
 * This guide shows how to update the existing swap page and components
 * to use the new enhanced hook with proper utilities.
 */

// ============================================================================
// OPTION 1: Minimal Migration (Keep Existing Components)
// ============================================================================

/**
 * If you want to keep using the existing swap UI components,
 * just swap the hook import and update a few key functions.
 * 
 * Location: app/swap/page.tsx
 */

// OLD
// import { useSwap } from "@/hooks/useSwap";

// NEW - Change to this single line:
import { useSwapEnhanced as useSwap } from "@/hooks/useSwapEnhanced";

// The hook API is compatible with minimal changes needed!

// ============================================================================
// OPTION 2: Step-by-Step Integration
// ============================================================================

/**
 * If you want to gradually migrate, follow these steps:
 */

// Step 1: Import the new hook alongside the old one
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";
import { useSwap as useSwapOld } from "@/hooks/useSwap";

// Step 2: Create a feature flag or manual toggle
const USE_ENHANCED_SWAP = true;

// Step 3: Conditionally use one or the other
const swapHook = USE_ENHANCED_SWAP ? useSwapEnhanced() : useSwapOld();

// ============================================================================
// FULL REFACTORED SWAP PAGE EXAMPLE
// ============================================================================

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Settings, ArrowDownUp } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";
import SwapSettings from "@/components/SwapSettings";
import SwapInput from "@/components/swapInput";
import TransactionNotification from "@/components/TransactionNotification";
import { usePrivy } from "@privy-io/react-auth";
import { TOKENS } from "@/constants/tokens";
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";

export default function SwapPageRefactored() {
  const { authenticated, login } = usePrivy();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Use the enhanced hook - single line for all functionality!
  const {
    sellToken,
    receiveToken,
    setSellToken,
    setReceiveToken,
    sellAmount,
    receiveAmount,
    setSellAmount,
    setReceiveAmount,
    slippage,
    customSlippage,
    setSlippage,
    setCustomSlippage,
    slippageOptions,
    quote,
    transactionStatus,
    errorMessage,
    isLoadingQuote,
    balance,
    prices,
    loadingMessage,
    swapTokens,
    handleMaxAmount,
    handlePercentage,
    executeSwap,
    resetTransaction,
    updateBalance,
    isAuthenticated,
    walletAddress,
  } = useSwapEnhanced();

  // ========================================================================
  // Handlers (mostly compatible with existing code)
  // ========================================================================

  const handleSwap = async () => {
    if (!walletAddress || transactionStatus === "loading") return;
    await executeSwap();
  };

  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Privy login failed:", error);
    }
  };

  const closeNotification = () => {
    if (transactionStatus === "loading") return; // Don't close while loading
    setShowNotification(false);
    resetTransaction();
  };

  // ========================================================================
  // Show notification when status changes
  // ========================================================================

  useEffect(() => {
    if (transactionStatus !== "idle") {
      setShowNotification(true);
    }
  }, [transactionStatus]);

  // ========================================================================
  // Disabled state calculation
  // ========================================================================

  const isSwapDisabled =
    !sellAmount ||
    parseFloat(sellAmount) === 0 ||
    transactionStatus === "loading" ||
    !isAuthenticated ||
    parseFloat(sellAmount) > parseFloat(balance);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        activeTab="Swap"
      />

      {/* Transaction Notifications */}
      <TransactionNotification
        isVisible={showNotification}
        status={transactionStatus}
        sellAmount={sellAmount}
        sellToken={sellToken.symbol}
        receiveAmount={receiveAmount}
        receiveToken={receiveToken.symbol}
        onClose={closeNotification}
        errorMessage={errorMessage}
      />

      {/* Settings Modal */}
      <SwapSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
        customSlippage={customSlippage}
        onCustomSlippageChange={setCustomSlippage}
        slippageOptions={slippageOptions}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          {/* Swap Card */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg p-6 shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-white">Swap</h1>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <Settings className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            {/* Connection Warning */}
            {!isAuthenticated && (
              <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg text-yellow-200">
                Please connect your wallet to swap tokens
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Sell Token Input */}
            <SwapInput
              label="You're selling"
              token={sellToken}
              amount={sellAmount}
              onAmountChange={setSellAmount}
              balance={balance}
              onMax={handleMaxAmount}
              onPercentage={handlePercentage}
              isLoading={isLoadingQuote && sellAmount !== ""}
              onTokenChange={setSellToken}
              availableTokens={[TOKENS.LEXA, TOKENS.BNB]}
            />

            {/* Swap Direction Button */}
            <div className="flex justify-center my-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={swapTokens}
                className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full hover:shadow-lg transition"
              >
                <ArrowDownUp className="w-5 h-5 text-white" />
              </motion.button>
            </div>

            {/* Receive Token Display */}
            <SwapInput
              label="You're receiving"
              token={receiveToken}
              amount={receiveAmount}
              isLoading={isLoadingQuote && sellAmount !== ""}
              onTokenChange={setReceiveToken}
              availableTokens={[TOKENS.LEXA, TOKENS.BNB]}
              readOnly={true}
            />

            {/* Quote Information */}
            {quote && !isLoadingQuote && sellAmount && (
              <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Exchange Rate</p>
                    <p className="text-white font-semibold">
                      1 {sellToken.symbol} = {quote.exchangeRate} {receiveToken.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Minimum Received</p>
                    <p className="text-white font-semibold">
                      {quote.minimumReceived} {receiveToken.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Fee</p>
                    <p className="text-white font-semibold">{quote.fee}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Price Impact</p>
                    <p className="text-white font-semibold">
                      ~{quote.priceImpact}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Message */}
            {(isLoadingQuote || transactionStatus === "loading") && loadingMessage && (
              <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg text-blue-200 text-sm">
                {loadingMessage}
              </div>
            )}

            {/* Swap Button */}
            <motion.button
              whileHover={!isSwapDisabled ? { scale: 1.02 } : {}}
              whileTap={!isSwapDisabled ? { scale: 0.98 } : {}}
              onClick={isAuthenticated ? handleSwap : handleConnect}
              disabled={isSwapDisabled}
              className={`w-full mt-6 py-3 rounded-lg font-semibold transition ${
                isSwapDisabled
                  ? "bg-slate-600 text-slate-400 cursor-not-allowed opacity-50"
                  : isAuthenticated
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-lg"
                    : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {transactionStatus === "loading"
                ? "Swapping..."
                : !isAuthenticated
                  ? "Connect Wallet"
                  : "Swap"}
            </motion.button>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg text-slate-300 text-sm">
            <p className="font-semibold mb-2">Safe Swap</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Swaps execute on PancakeSwap Router V2</li>
              <li>Your tokens are never held by our contract</li>
              <li>Transactions signed directly in your wallet</li>
              <li>LEXA has a 5% transfer tax applied by token</li>
            </ul>
          </div>
        </motion.div>
      </main>
    </>
  );
}

// ============================================================================
// TESTING THE INTEGRATION
// ============================================================================

/**
 * Test checklist:
 * 
 * 1. Connect wallet
 *    ✓ Privy connection still works
 *    ✓ Wallet address detected
 *    ✓ Balance updates
 * 
 * 2. Fetch quotes
 *    ✓ Enter sell amount
 *    ✓ Quote appears after debounce
 *    ✓ Receive amount updates
 * 
 * 3. Execute swap
 *    ✓ Click swap (approval if needed)
 *    ✓ Confirm in wallet
 *    ✓ See loading state
 *    ✓ Transaction confirmed
 * 
 * 4. Error handling
 *    ✓ Insufficient balance error
 *    ✓ Network error message
 *    ✓ User rejection handled
 *    ✓ Invalid amount error
 * 
 * 5. Token swapping
 *    ✓ LEXA ↔ BNB works
 *    ✓ Quotes are accurate
 *    ✓ Balances update after swap
 */

// ============================================================================
// COMPARISON: OLD vs NEW
// ============================================================================

/**
 * OLD APPROACH (useSwap)
 * ========================
 * ❌ Complex state management (many useState calls)
 * ❌ Manual quote fetching logic
 * ❌ Hard to test individual functions
 * ❌ Error handling spread across component
 * ❌ Balance updates not automatic
 * 
 * NEW APPROACH (useSwapEnhanced)
 * ==============================
 * ✅ Centralized state in hook
 * ✅ Debounced quote fetching built-in
 * ✅ Reusable utility functions (testable)
 * ✅ Proper error classes
 * ✅ Automatic balance refresh
 * ✅ Better TypeScript support
 * ✅ Production-ready error handling
 */

// ============================================================================
// ADVANCED: Using Utilities Directly
// ============================================================================

/**
 * For advanced use cases, you can use the utilities directly:
 */

import {
  getTokenBalance,
  getSwapQuote,
  approveToken,
  executeTokenSwap,
  buildSwapPath,
} from "@/utils/swapUtils";

async function advancedSwapFlow() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // 1. Check balance
  const balance = await getTokenBalance(
    provider,
    TOKENS.LEXA.address,
    userAddress
  );
  console.log("LEXA Balance:", balance);

  // 2. Get quote
  const quote = await getSwapQuote(
    provider,
    "100", // 100 LEXA
    TOKENS.LEXA.address,
    TOKENS.BNB.address
  );
  console.log("Quote:", quote);

  // 3. Approve if needed
  // (Already handled by executeTokenSwap in most cases)

  // 4. Execute swap
  const path = buildSwapPath(TOKENS.LEXA.address, TOKENS.BNB.address);
  const result = await executeTokenSwap(
    signer,
    "100",
    quote.amountOut,
    path,
    userAddress
  );
  console.log("Swap hash:", result.hash);
}
