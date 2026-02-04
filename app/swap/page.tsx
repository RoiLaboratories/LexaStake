"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Settings, ArrowDownUp } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";

import { swapService } from "@/services/swap.service";
import { useSwap } from "@/hooks/useSwap";
import TransactionNotification from "@/components/TransactionNotification";
import SwapSettings from "@/components/SwapSettings";
import SwapInput from "@/components/swapInput";
import { usePrivy, User } from "@privy-io/react-auth";
import { TOKENS } from "@/constants/tokens";

function extractWalletAddress(user: User | null): string | null {
  if (!user) return null;
  if (user.wallet?.address) return user.wallet.address;
  const walletAccount = user.linkedAccounts?.find(
    (acc) => "type" in acc && acc.type === "wallet",
  );
  if (walletAccount && "address" in walletAccount) {
    return (walletAccount as { address: string }).address;
  }
  return null;
}

export default function SwapPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [bnbBalance, setBnbBalance] = useState<string | null>(null);
  const [lexaBalance, setLexaBalance] = useState<string | null>(null);
  const [pendingNotification, setPendingNotification] = useState(false);

  const { authenticated, user, login } = usePrivy();

  const {
    sellToken,
    receiveToken,
    sellAmount,
    receiveAmount,
    slippage,
    customSlippage,
    transactionStatus,
    balance,
    isLoadingQuote,
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
  } = useSwap();

  // Connect wallet handler using Privy
  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Privy login failed:", error);
    }
  };

  // Derive wallet address from Privy user
  useEffect(() => {
    const addr = extractWalletAddress(user);
    if (addr !== walletAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWalletAddress(addr);
    }
  }, [user, walletAddress]);

  // Fetch balances when authenticated and address available
  useEffect(() => {
    if (!authenticated || !walletAddress) return;

    const fetchBalances = async () => {
      try {
        // Fetch sell token balance (used by swap inputs)
        const sellBalanceData = await swapService.getWalletBalance(
          walletAddress,
          sellToken.address || "",
        );
        updateBalance(sellBalanceData.balance);

        // Fetch BNB and LEXA balances for display
        const bnbData = await swapService.getWalletBalance(
          walletAddress,
          TOKENS.BNB.address,
        );
        const lexaData = await swapService.getWalletBalance(
          walletAddress,
          TOKENS.LEXA.address,
        );

        setBnbBalance(bnbData.balance);
        setLexaBalance(lexaData.balance);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [authenticated, walletAddress, sellToken, updateBalance]);

  // Handle transaction notifications
  useEffect(() => {
    const isActive =
      transactionStatus === "loading" ||
      transactionStatus === "success" ||
      transactionStatus === "error";
    
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingNotification(false);
      return;
    }

    setPendingNotification(true);

    if (transactionStatus !== "loading") {
      const timer = setTimeout(() => {
        setShowNotification(false);
        setPendingNotification(false);
        resetTransaction();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [transactionStatus, resetTransaction]);

  useEffect(() => {
    if (pendingNotification) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNotification(true);
    }
  }, [pendingNotification]);

  const handleSlippageSelect = (value: string) => {
    setSlippage(value);
    setCustomSlippage("");
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    setSlippage("custom");
  };

  const handleSwap = async () => {
    if (!walletAddress || transactionStatus === "loading") return;
    await executeSwap(walletAddress);
  };

  const closeNotification = () => {
    setShowNotification(false);
    resetTransaction();
  };

  const isSwapDisabled =
    !sellAmount ||
    parseFloat(sellAmount) === 0 ||
    transactionStatus === "loading";

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
      />

      {/* Settings Modal */}
      <SwapSettings
        isOpen={showSettings}
        slippage={slippage}
        customSlippage={customSlippage}
        onClose={() => setShowSettings(false)}
        onSlippageSelect={handleSlippageSelect}
        onCustomSlippageChange={handleCustomSlippageChange}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 lg:pb-20 min-h-[calc(100vh-200px)] py-8 sm:py-20">
        <div className="max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-yellow-600/50 rounded-3xl p-4 sm:p-8 bg-black/60 backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="flex flex-col">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Swap Tokens</h2>
                <div className="text-xs text-gray-400 mt-1 flex gap-4">
                  <span>BNB: {bnbBalance ? parseFloat(bnbBalance).toLocaleString() : "—"}</span>
                  <span>LEXA: {lexaBalance ? parseFloat(lexaBalance).toLocaleString() : "—"}</span>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
              </button>
            </div>

            {/* Sell Section */}
            <div className="mb-3">
              <SwapInput
                label="Sell"
                token={sellToken}
                amount={sellAmount}
                balance={balance}
                onAmountChange={setSellAmount}
                onMaxClick={handleMaxAmount}
                onPercentageClick={handlePercentage}
                disabled={!authenticated}
                showBalance={true}
                isLoading={false}
              />
            </div>

            {/* Swap Arrow Button */}
            <div className="flex justify-center -my-[25px] relative z-10">
              <motion.button
                onClick={swapTokens}
                className="w-10 h-10 rounded-xl bg-gray-800/80 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowDownUp className="w-5 h-5 text-gray-400" />
              </motion.button>
            </div>

            {/* Receive Section */}
            <div className="mb-6 sm:mb-8">
              <SwapInput
                label="Receive"
                token={receiveToken}
                amount={receiveAmount}
                onAmountChange={setReceiveAmount}
                disabled={!authenticated}
                showBalance={true}
                isLoading={isLoadingQuote}
              />
            </div>

            {/* Quote Information (Optional) */}
            {sellAmount && parseFloat(sellAmount) > 0 && (
              <div className="mb-6 p-4 bg-gray-900/30 rounded-xl text-sm">
                <div className="flex justify-between text-gray-400 mb-2">
                  <span>Exchange Rate</span>
                  <span className="text-white">
                    1 {sellToken.symbol} ≈{" "}
                    {receiveAmount && sellAmount
                      ? (
                          parseFloat(receiveAmount) / parseFloat(sellAmount)
                        ).toFixed(6)
                      : "0"}{" "}
                    {receiveToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Slippage Tolerance</span>
                  <span className="text-white">
                    {slippage === "custom" ? customSlippage : slippage}%
                  </span>
                </div>
              </div>
            )}

            {/* Connect/Swap Button */}
            <div className="flex justify-center">
              {!authenticated ? (
                <button
                  onClick={handleConnect}
                  className="w-full sm:w-3/4 px-6 py-3 sm:py-4 bg-yellow-500 text-black rounded-2xl font-bold text-base sm:text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
                >
                  Connect wallet
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={isSwapDisabled}
                  className={`w-full sm:w-3/4 px-6 py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 ${
                    !isSwapDisabled
                      ? "bg-yellow-500 text-black hover:bg-yellow-400 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                      : "bg-yellow-600 text-black cursor-not-allowed opacity-70"
                  }`}
                >
                  {transactionStatus === "loading" ? "Processing..." : "Swap"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
