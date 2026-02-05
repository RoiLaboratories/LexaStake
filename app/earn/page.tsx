"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";

export default function EarnPage() {
  const [copied, setCopied] = useState(false);

  const referralLink = "https://lexastake.xyz";

  const handleCopy = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <StakeHeader showMenu={true} showConnectButton={true} activeTab="Earn" />
      <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 ">
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
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border-2 border-yellow-500 text-yellow-500 rounded-xl sm:rounded-md font-bold hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-2 justify-center min-w-30"
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
          </motion.div>
        </div>
      </main>
    </>
  );
}
