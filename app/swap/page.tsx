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
  const [sellTokenBalance, setSellTokenBalance] = useState<string | null>(null);
  const [receiveTokenBalance, setReceiveTokenBalance] = useState<string | null>(null);

  const { authenticated, user, login } = usePrivy();

  useEffect(() => {
    console.log("📄 [SWAP_PAGE] Component mounted - console is working!");
    console.warn("⚠️ [SWAP_PAGE] If you see this message, the page loaded correctly");
    
    // Add global error listener as fallback
    const handleError = (event: ErrorEvent) => {
      console.error("❌ [GLOBAL] Unhandled error:", event.error);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("❌ [GLOBAL] Unhandled promise rejection:", event.reason);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    
    // Expose test function to window for manual testing
    (window as any).testSwapConsole = () => {
      console.log("🧪 [TEST] CONSOLE TEST - You clicked the test function!");
      console.warn("✓ Console is working and can receive your input");
    };
    console.log("🧪 [TEST] Type this in console to test: testSwapConsole()");
    
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  const {
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

  // Ensure correct network after login
  useEffect(() => {
    if (!authenticated || !walletAddress) return;

    const ensureCorrectNetwork = async () => {
      try {
        if (!window.ethereum) {
          console.warn("⚠️ window.ethereum not available");
          return;
        }

        // Get current chain
        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        }) as string;

        console.log(`🌐 [SWAP_PAGE] Current chain ID: ${chainId}`);

        // BNB Chain is 0x38 (56 in decimal)
        const BNB_CHAIN_HEX = "0x38";

        if (chainId !== BNB_CHAIN_HEX) {
          console.warn(
            `⚠️ [SWAP_PAGE] Not on BNB Chain! Current: ${chainId}, Expected: ${BNB_CHAIN_HEX}`
          );
          console.log("🔄 [SWAP_PAGE] Forcing switch to BNB Chain...");

          try {
            // Try to switch
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: BNB_CHAIN_HEX }],
            });

            console.log("✓ [SWAP_PAGE] Successfully switched to BNB Chain");
          } catch (switchError: any) {
            // If chain not added, add it first
            if (switchError.code === 4902) {
              console.log(
                "⚠️ [SWAP_PAGE] BNB Chain not found, attempting to add..."
              );
              try {
                await window.ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: BNB_CHAIN_HEX,
                      chainName: "BNB Smart Chain",
                      nativeCurrency: {
                        name: "BNB",
                        symbol: "BNB",
                        decimals: 18,
                      },
                      rpcUrls: ["https://bsc-dataseed1.binance.org:443"],
                      blockExplorerUrls: ["https://bscscan.com"],
                    },
                  ],
                });

                console.log("✓ [SWAP_PAGE] BNB Chain added, now switching...");

                // Now switch
                await window.ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: BNB_CHAIN_HEX }],
                });

                console.log("✓ [SWAP_PAGE] Successfully switched after adding");
              } catch (addError) {
                console.error(
                  "❌ [SWAP_PAGE] Failed to add/switch to BNB Chain:",
                  addError
                );
              }
            } else {
              console.error("❌ [SWAP_PAGE] Failed to switch chain:", switchError);
            }
          }
        } else {
          console.log("✓ [SWAP_PAGE] Already on BNB Chain (0x38)");
        }
      } catch (error) {
        console.error("❌ [SWAP_PAGE] Error checking/switching network:", error);
      }
    };

    ensureCorrectNetwork();
  }, [authenticated, walletAddress]);

  // Set up wallet provider event listeners
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.warn("⚠️ [WALLET_EVENT] Accounts changed:", accounts);
      if (accounts.length === 0) {
        console.error("❌ [WALLET_EVENT] Wallet disconnected!");
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.warn(`⚠️ [WALLET_EVENT] Chain changed to: ${chainId}`);
      if (chainId !== "0x38") {
        console.error(`❌ [WALLET_EVENT] NOT ON BNB CHAIN! Current: ${chainId}, Expected: 0x38`);
      }
    };

    const handleDisconnect = (error: any) => {
      console.error("❌ [WALLET_EVENT] Wallet disconnected:", error);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    console.log("✓ [SWAP_PAGE] Wallet event listeners installed");

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
      window.ethereum.removeListener("disconnect", handleDisconnect);
      console.log("✓ [SWAP_PAGE] Wallet event listeners removed");
    };
  }, []);

  // Fetch LEXA and BNB balances in one call when authenticated
  useEffect(() => {
    if (!authenticated || !walletAddress) return;

    const fetchBalances = async () => {
      try {
        // Single API call for both LEXA and BNB (uses Alchemy first when configured)
        const allBalances = await swapService.getAllBalances(walletAddress);
        const bnbEntry = allBalances.find((b) => b.token === "BNB");
        const lexaEntry = allBalances.find((b) => b.token === "LEXA");
        const bnbBalance = bnbEntry?.balance ?? "0";
        const lexaBalance = lexaEntry?.balance ?? "0";

        setSellTokenBalance(
          sellToken.symbol === "BNB" ? bnbBalance : lexaBalance
        );
        setReceiveTokenBalance(
          receiveToken.symbol === "BNB" ? bnbBalance : lexaBalance
        );
        updateBalance(sellToken.symbol === "BNB" ? bnbBalance : lexaBalance);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
  }, [authenticated, walletAddress, sellToken, receiveToken, updateBalance]);

  // Handle transaction notifications
  useEffect(() => {
    console.log("🔔 Modal visibility effect triggered - transactionStatus:", transactionStatus);
    
    const isActive =
      transactionStatus === "loading" ||
      transactionStatus === "success" ||
      transactionStatus === "error";
    
    if (!isActive) {
      console.log("Modal becoming inactive, hiding");
      setShowNotification(false);
      return;
    }

    // Show notification for loading, success, and error states
    console.log("Modal becoming active, showing");
    setShowNotification(true);

    // Auto-hide success/error after 5 seconds
    if (transactionStatus === "success" || transactionStatus === "error") {
      console.log("Setting 5s timer to auto-close modal");
      const timer = setTimeout(() => {
        console.log("5s timer fired, closing modal and resetting");
        setShowNotification(false);
        resetTransaction();
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Keep loading notification visible indefinitely
  }, [transactionStatus, resetTransaction]);

  const handleSlippageSelect = (value: string) => {
    setSlippage(value);
    setCustomSlippage("");
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    setSlippage("custom");
  };

  const handleSwap = async () => {
    console.warn("🚨 [SWAP_PAGE] BUTTON CLICKED - handleSwap function started executing!");
    console.log("🎯 [SWAP_PAGE] ========== SWAP INITIATED ==========");
    console.log(`⏱️  [SWAP_PAGE] Timestamp: ${new Date().toISOString()}`);
    console.log("🎯 [SWAP_PAGE] Current state:", { 
      walletAddressDefined: !!walletAddress, 
      walletAddress: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "NOT SET",
      transactionStatus, 
      authenticated,
      sellAmount,
      sellToken: sellToken.symbol,
      receiveToken: receiveToken.symbol,
      slippage: slippage === "custom" ? customSlippage : slippage,
    });

    if (!walletAddress) {
      console.error("❌ [SWAP_PAGE] Wallet address is not set!");
      return;
    }

    if (transactionStatus === "loading") {
      console.warn("⚠️ [SWAP_PAGE] Swap already in progress, ignoring duplicate request");
      return;
    }

    console.log("✓ [SWAP_PAGE] Validation passed, calling executeSwap...");
    
    try {
      // Check wallet connection status
      if (!window.ethereum) {
        console.error("❌ [SWAP_PAGE] window.ethereum is not available!");
        throw new Error("Wallet not connected");
      }

      // Verify we can get accounts
      const accounts = await window.ethereum.request?.({ method: "eth_accounts" }) as string[] | undefined;
      console.log("🔐 [SWAP_PAGE] Connected accounts:", accounts);
      
      if (!accounts || accounts.length === 0) {
        console.error("❌ [SWAP_PAGE] No accounts available!");
        throw new Error("No wallet accounts available");
      }

      if (accounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn("⚠️ [SWAP_PAGE] Account mismatch! Active:", accounts[0], "Expected:", walletAddress);
      }

      // Verify network before starting swap
      const chainId = await window.ethereum.request?.({ method: "eth_chainId" }) as string | undefined;
      console.log(`🌐 [SWAP_PAGE] Network verification: chainId=${chainId} (expected 0x38)`);
      
      if (chainId !== "0x38") {
        console.error(`❌ [SWAP_PAGE] WRONG CHAIN! Current: ${chainId}, Expected: 0x38`);
        throw new Error(`Wrong network. Current: ${chainId}, Expected: 0x38. Please switch to BNB Chain.`);
      }

      console.log("✓ [SWAP_PAGE] Pre-flight checks passed, executing swap...");
      await executeSwap(walletAddress);
      
    } catch (preFlightError) {
      const errMsg = preFlightError instanceof Error ? preFlightError.message : String(preFlightError);
      console.error("❌ [SWAP_PAGE] Pre-flight check failed:", errMsg);
      console.error("❌ [SWAP_PAGE] Full pre-flight error:", preFlightError);
    }
    
    console.log("🎯 [SWAP_PAGE] ========== SWAP INITIATION COMPLETE ==========\n");

    console.log("🎯 [SWAP_PAGE] executeSwap completed");
  };

  const closeNotification = () => {
    // Don't allow closing the notification during loading
    if (transactionStatus === "loading") {
      return;
    }
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

      {/* DEBUG PANEL - Remove after debugging
      <div style={{
        position: "fixed",
        top: "100px",
        right: "10px",
        zIndex: 9999,
        background: "#1a1a1a",
        color: "#00ff00",
        padding: "12px",
        borderRadius: "4px",
        fontSize: "11px",
        fontFamily: "monospace",
        maxWidth: "300px",
        border: "2px solid #00ff00",
        maxHeight: "200px",
        overflow: "auto"
      }}>
        <div>🔧 DEBUG INFO</div>
        <div>Slippage: {slippage === "custom" ? customSlippage : slippage}%</div>
        <div>Status: {transactionStatus}</div>
        <div>Sell: {sellAmount || "0"} {sellToken.symbol}</div>
        <div>⏱️ {new Date().toLocaleTimeString()}</div>
        <button 
          onClick={() => console.log("DEBUG: StateCheck", {slippage, customSlippage, transactionStatus})}
          style={{marginTop: "8px", padding: "4px 8px", cursor: "pointer", background: "#00ff00", color: "#000"}}
        >
          Log State
        </button>
      </div> */}

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
              <h2 className="text-xl sm:text-2xl font-bold text-white">Swap Tokens</h2>
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
                tokenPrice={
                  sellToken.symbol === "BNB" ? prices.bnb : prices.lexa
                }
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
                balance={receiveTokenBalance || "0"}
                tokenPrice={
                  receiveToken.symbol === "BNB" ? prices.bnb : prices.lexa
                }
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
                  onClick={() => {
                    console.warn("🚨🚨🚨 SWAP BUTTON CLICKED - INLINE HANDLER 🚨🚨🚨");
                    handleSwap();
                  }}
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
