"use client";
import { motion } from "framer-motion";
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

  const lexaBalance = 0;

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

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        activeTab="Swap"
      />
      <main className="min-h-screen flex items-center justify-center px-4 py-20 ">
        <div className="max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-yellow-600/50 rounded-3xl p-8 bg-black/60 backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Swap Tokens</h2>
              <button className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors">
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
                    <span>{isConnected ? lexaBalance : 0} LEXA</span>
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
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="w-full px-6 py-4 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
              >
                Connect wallet
              </button>
            ) : (
              <button
                disabled={!sellAmount || parseFloat(sellAmount) === 0}
                className={`w-full px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                  sellAmount && parseFloat(sellAmount) > 0
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                    : "bg-yellow-600 text-black cursor-not-allowed opacity-70"
                }`}
              >
                Swap
              </button>
            )}
          </motion.div>
        </div>
      </main>
    </>
  );
}
