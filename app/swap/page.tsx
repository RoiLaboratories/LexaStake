"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import { Settings, ArrowDownUp } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";

export default function SwapPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [sellAmount, setSellAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [sellToken, setSellToken] = useState("LEXA");
  const [receiveToken, setReceiveToken] = useState("BNB");
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState("0.2");
  const [customSlippage, setCustomSlippage] = useState("");
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [showNotification, setShowNotification] = useState(false);

  const lexaBalance = 100000;

  const handleConnect = () => {
    const mockAddress = "0xAB9.....875R6";
    setWalletAddress(mockAddress);
    setIsConnected(true);
  };

  const handleSwapTokens = () => {
    const tempToken = sellToken;
    setSellToken(receiveToken);
    setReceiveToken(tempToken);
    const tempAmount = sellAmount;
    setSellAmount(receiveAmount);
    setReceiveAmount(tempAmount);
  };

  const handleMax = () => {
    if (isConnected) {
      setSellAmount(lexaBalance.toString());
    }
  };

  const handleSlippageSelect = (value: string) => {
    setSlippage(value);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    setSlippage("custom");
  };

  const handleSwap = async () => {
    if (transactionStatus === "loading") return;

    setTransactionStatus("loading");
    setShowNotification(true);

    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate success or failure
    const sellValue = parseFloat(sellAmount);
    if (sellValue > lexaBalance) {
      setTransactionStatus("error");
    } else {
      setTransactionStatus("success");
    }

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
      setTransactionStatus("idle");
    }, 5000);
  };

  const closeNotification = () => {
    setShowNotification(false);
    setTransactionStatus("idle");
  };

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        activeTab="Swap"
      />

      {/* Transaction Notifications */}
      <AnimatePresence>
        {showNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`relative rounded-xl p-5 ${
                transactionStatus === "loading"
                  ? "bg-gray-900 border-2 border-gray-700"
                  : transactionStatus === "success"
                    ? "bg-gray-900 border-2 border-green-500"
                    : "bg-gray-900 border-2 border-red-500"
              }`}
            >
              {/* Close button */}
              {transactionStatus !== "loading" && (
                <button
                  onClick={closeNotification}
                  className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}

              {/* Loading State */}
              {transactionStatus === "loading" && (
                <div className="text-center">
                  <div className="inline-block w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <h3 className="text-lg font-bold text-white">
                    Transaction Loading...
                  </h3>
                </div>
              )}

              {/* Error State */}
              {transactionStatus === "error" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Token swap failed!
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    Insufficient balance to perform the swap, deposit LEXA to
                    continue
                  </p>
                  <button className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
                    View transaction
                  </button>
                </div>
              )}

              {/* Success State */}
              {transactionStatus === "success" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Token swapped successfully!
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                    Swapped {parseFloat(sellAmount).toLocaleString()}{" "}
                    {sellToken}
                  </p>
                  <p className="text-gray-400 text-sm mb-3 leading-relaxed">
                    for {receiveAmount || "0.1"} {receiveToken}
                  </p>
                  <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
                    <Image
                      src="/assets/LexaLogo2.svg"
                      alt="LEXA"
                      width={16}
                      height={16}
                      className="opacity-70"
                    />
                    <span>Via LEXA Swap</span>
                  </div>
                  <button className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
                    View transaction
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowSettings(false)}
            />
            <div className="fixed inset-0 flex items-start justify-center z-50 pt-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700"
              >
                <h3 className="text-xl font-bold text-white mb-6">
                  Swap Settings
                </h3>

                <div className="mb-6">
                  <label className="text-gray-400 text-sm font-semibold mb-3 block">
                    Slippage
                  </label>
                  <div className="flex items-center gap-2">
                    {["0.1", "0.2", "0.5"].map((value) => (
                      <button
                        key={value}
                        onClick={() => handleSlippageSelect(value)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          slippage === value
                            ? "bg-yellow-500 text-black"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {value}%
                      </button>
                    ))}
                    <button
                      onClick={() => handleSlippageSelect("custom")}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        slippage === "custom"
                          ? "bg-yellow-500 text-black"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      Custom
                    </button>
                    <input
                      type="text"
                      value={customSlippage}
                      onChange={(e) => handleCustomSlippage(e.target.value)}
                      placeholder="0.0"
                      className="w-20 px-3 py-2 bg-gray-800 text-white rounded-lg outline-none text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full px-6 py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 lg:pb-20 min-h-[calc(100vh-200px)] py-20">
        <div className="max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-yellow-600/50 rounded-3xl p-8 bg-black/60 backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Swap Tokens</h2>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <Settings className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Sell Section */}
            <div className="bg-gray-900/50 rounded-2xl p-5 mb-3">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400 font-semibold text-sm">
                  Sell
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Image
                      src="/assets/LexaLogo2.svg"
                      alt="wallet"
                      width={16}
                      height={16}
                      className="opacity-70"
                    />
                    <span>
                      {isConnected ? lexaBalance.toLocaleString() : 0} LEXA
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setSellAmount((lexaBalance * 0.5).toString())
                    }
                    disabled={!isConnected}
                    className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    50%
                  </button>
                  <button
                    onClick={handleMax}
                    disabled={!isConnected}
                    className="px-2 py-1 border border-yellow-500 text-yellow-500 rounded text-xs font-bold hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Image
                      src="/assets/LexaLogo2.svg"
                      alt="LEXA"
                      width={20}
                      height={20}
                    />
                  </div>
                  <span className="text-white font-semibold">{sellToken}</span>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <div className="flex flex-col items-end">
                  <input
                    type="text"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!isConnected}
                    className="bg-transparent text-4xl text-white font-bold outline-none text-right w-48 placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-500 text-sm mt-1">~$0</span>
                </div>
              </div>
            </div>

            {/* Swap Arrow Button */}
            <div className="flex justify-center -my-4 relative z-10">
              <motion.button
                onClick={handleSwapTokens}
                className="w-10 h-10 rounded-xl bg-gray-800/80 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowDownUp className="w-5 h-5 text-gray-400" />
              </motion.button>
            </div>

            {/* Receive Section */}
            <div className="bg-gray-900/50 rounded-2xl p-5 mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400 font-semibold text-sm">
                  Receive
                </span>
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Image
                    src="/assets/LexaLogo2.svg"
                    alt="wallet"
                    width={16}
                    height={16}
                    className="opacity-70"
                  />
                  <span>--</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <span className="text-yellow-500 text-xs font-bold">
                      BNB
                    </span>
                  </div>
                  <span className="text-white font-semibold">
                    {receiveToken}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <div className="flex flex-col items-end">
                  <input
                    type="text"
                    value={receiveAmount}
                    onChange={(e) => setReceiveAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!isConnected}
                    className="bg-transparent text-4xl text-white font-bold outline-none text-right w-48 placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-500 text-sm mt-1">~$0</span>
                </div>
              </div>
            </div>

            {/* Connect/Swap Button */}
            <div className="flex justify-center">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  className="w-3/4 px-6 py-4 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
                >
                  Connect wallet
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={
                    !sellAmount ||
                    parseFloat(sellAmount) === 0 ||
                    transactionStatus === "loading"
                  }
                  className={`w-3/4 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                    sellAmount &&
                    parseFloat(sellAmount) > 0 &&
                    transactionStatus !== "loading"
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
