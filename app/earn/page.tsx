"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";

export default function EarnPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleConnect = () => {
    const mockAddress = "0xAB9.....875R6";
    setWalletAddress(mockAddress);
    setIsConnected(true);
  };

  const referralLink = isConnected
    ? `https://lexastake.xyz?ref=${walletAddress?.replace(/\./g, "")}`
    : "";

  const handleCopy = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        activeTab="Earn"
      />
      <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="max-w-5xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6 sm:space-y-8"
          >
            {/* Hero Title */}
            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight px-2">
                <span className="text-yellow-500">Earn</span>{" "}
                <span className="text-white">passively with</span>{" "}
                <span className="text-yellow-500">Lexastake</span>
                <br />
                <span className="text-white">referral program</span>
              </h1>

              <p className="text-gray-300 text-base sm:text-lg md:text-xl max-w-3xl mx-auto px-2">
                Earn up to 50 LEXA for referring friends to stake LEXA and 2% of
                purchase amounts from users who buys LEXA using Lexaswap
              </p>
            </div>

            {/* Referral Link Section */}
            {!isConnected ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="max-w-2xl mx-auto px-2"
              >
                <button
                  onClick={handleConnect}
                  className="w-full border-2 border-yellow-600/50 rounded-2xl p-4 sm:p-6 bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:border-yellow-500 transition-all cursor-pointer"
                >
                  <p className="text-yellow-500 text-base sm:text-lg font-semibold">
                    Connect wallet to generate your referral link
                  </p>
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="max-w-4xl mx-auto space-y-3 sm:space-y-4 px-2"
              >
                <h3 className="text-white text-base sm:text-lg font-semibold text-left">
                  Share referral link
                </h3>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 border-2 border-yellow-600/50 rounded-xl sm:rounded-md p-3 sm:p-4 bg-black/40 backdrop-blur-sm overflow-hidden">
                    <p className="text-white text-left font-mono text-xs sm:text-sm md:text-base break-all">
                      {referralLink}
                    </p>
                  </div>

                  <motion.button
                    onClick={handleCopy}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border-2 border-yellow-500 text-yellow-500 rounded-xl sm:rounded-md font-bold hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-2 justify-center min-w-[120px]"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-sm sm:text-base">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-sm sm:text-base">Copy</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 px-4 sm:px-8 py-4 sm:py-6 bg-transparent">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-3 sm:gap-0">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-xs">©</span>
            </div>
            <span className="text-xs sm:text-sm">Lexastake 2026</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <motion.a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              className="text-gray-500 hover:text-yellow-500 transition-colors"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </motion.a>

            <motion.a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              className="text-gray-500 hover:text-yellow-500 transition-colors"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
              </svg>
            </motion.a>

            <motion.a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              className="text-gray-500 hover:text-yellow-500 transition-colors"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </motion.a>
          </div>
        </div>
      </footer>
    </>
  );
}
