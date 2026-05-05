"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";
import { usePrivy, User } from "@privy-io/react-auth";
import { supabaseService } from "@/services/supabase.service";

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

export default function EarnPage() {
  const { authenticated, user } = usePrivy();
  const [copied, setCopied] = useState(false);
  const [swapReferralLink, setSwapReferralLink] = useState("");
  const [referralEarnings, setReferralEarnings] = useState<{
    totalEarnings: string;
    totalReferrals: number;
    pending: number;
    completed: number;
  } | null>(null);
  const [swapEarnings, setSwapEarnings] = useState<{
    totalEarnings: string;
    totalReferrals: number;
    pending: number;
    completed: number;
  } | null>(null);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);

  useEffect(() => {
    if (authenticated && user) {
      const walletAddress = extractWalletAddress(user);
      if (walletAddress) {
        // Generate both referral links
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://lexaswap.xyz";
        // const stakeLink = `${baseUrl}/stake?ref=${walletAddress}`;
        const swapLink = `${baseUrl}/swap?ref=${walletAddress}`;
        // setStakeReferralLink(stakeLink);
        setSwapReferralLink(swapLink);
        console.log("📤 Swap referral link generated:", swapLink);

        // Fetch referral earnings
        fetchReferralEarnings(walletAddress);
      }
    } else {
      setSwapReferralLink("https://lexaswap.xyz");
      setSwapEarnings(null);
    }
  }, [authenticated, user]);

  const fetchReferralEarnings = async (walletAddress: string) => {
    setIsLoadingEarnings(true);
    try {
      // Fetch stake referral earnings
      const stakeData = await supabaseService.getReferralEarnings(walletAddress);
      if (stakeData) {
        setReferralEarnings({
          totalEarnings: stakeData.totalEarnings || "0",
          totalReferrals: stakeData.totalReferrals || 0,
          pending: stakeData.statuses?.pending || 0,
          completed: stakeData.statuses?.completed || 0,
        });
      }

      // Fetch swap referral earnings
      const swapData = await supabaseService.getSwapReferralEarnings(walletAddress);
      if (swapData) {
        setSwapEarnings({
          totalEarnings: swapData.totalEarnings || "0",
          totalReferrals: swapData.totalReferrals || 0,
          pending: swapData.statuses?.pending || 0,
          completed: swapData.statuses?.completed || 0,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching earnings:", error);
    } finally {
      setIsLoadingEarnings(false);
    }
  };

  const currentLink = swapReferralLink;
  const currentEarnings = swapEarnings;

  const handleCopy = async () => {
    if (currentLink) {
      await navigator.clipboard.writeText(currentLink);
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
                <span className="text-yellow-500">LexaSwap</span>
                <br />
                <span className="text-white">referral program</span>
              </h1>

              <p className="text-gray-300 text-base sm:text-lg md:text-xl max-w-3xl mx-auto px-2 whitespace-nowrap">
                Earn up to 2% of purchase amounts from users who buys LEXA using LexaSwap
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

              {/* Tabs for Stake and Swap */}
              <div className="flex gap-2 sm:gap-3 mb-4">
                {/* <button
                  onClick={() => setSelectedReferralType("stake")}
                  className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all ${
                    selectedReferralType === "stake"
                      ? "bg-yellow-500 text-black"
                      : "border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                  }`}
                >
                  Stake Referral
                </button> */}
                {/* <button
                  onClick={() => setSelectedReferralType("swap")}
                  className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all ${
                    selectedReferralType === "swap"
                      ? "bg-yellow-500 text-black"
                      : "border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                  }`}
                >
                  Swap Referral
                </button> */}
              </div>

              {/* Reward Info */}
              <div className="text-left mb-3">
                <p className="text-gray-300 text-sm sm:text-base">
                  {/* {selectedReferralType === "stake" */}
                    {/* // ? "Earn 50 LEXA when your referral stakes" */}
                    Earn 2% of purchase amount in BNB when your referral swaps
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 border-2 border-yellow-600/50 rounded-xl sm:rounded-md p-3 sm:p-4 bg-black/40 backdrop-blur-sm overflow-hidden">
                  <p className="text-white text-left font-mono text-xs sm:text-sm md:text-base break-all">
                    {currentLink}
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
