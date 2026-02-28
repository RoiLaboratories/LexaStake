"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, User } from "@privy-io/react-auth";
import StakeHeader from "@/components/StakeHeader";
import StakingTab from "@/components/StakingTab";
import ReferralsTab from "@/components/ReferralsTab";
import ActivitiesTab from "@/components/ActivitiesTab";
import { swapService } from "@/services/swap.service";
import { supabaseService } from "@/services/supabase.service";
import { TOKENS } from "@/constants/tokens";

interface StakingHistoryItem {
  id?: string;
  user_address: string;
  stake_index: number;
  amount: string;
  tier: "Bronze" | "Silver" | "Gold";
  lock_period: number;
  roi_percentage: number;
  start_time: number;
  lock_end_time: number;
  active?: boolean;
  tx_hash: string;
  created_at?: string;
}

interface ActivityItem {
  id?: string;
  user_address: string;
  tx_hash: string;
  tx_type: "stake" | "unstake" | "claim_rewards" | "restake" | "swap";
  status?: "pending" | "confirmed" | "failed";
  amount?: string;
  details?: Record<string, any>;
  created_at?: string;
}

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

const Profile = () => {
  const [activeTab, setActiveTab] = useState("staking");
  const [lexaBalance, setLexaBalance] = useState<string | null>(null);
  const [bnbBalance, setBnbBalance] = useState<string | null>(null);
  const [stakingHistory, setStakingHistory] = useState<StakingHistoryItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { authenticated, user } = usePrivy();

  useEffect(() => {
    const addr = extractWalletAddress(user);
    if (!addr || !authenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLexaBalance(null);
      setBnbBalance(null);
      setStakingHistory([]);
      setActivities([]);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch balances
        const lexaData = await swapService.getWalletBalance(
          addr,
          TOKENS.LEXA.address,
        );
        const bnbData = await swapService.getWalletBalance(
          addr,
          TOKENS.BNB.address,
        );
        setLexaBalance(lexaData.balance);
        setBnbBalance(bnbData.balance);

        // Fetch staking history
        const stakingData = await supabaseService.getUserStakingHistory(addr);
        setStakingHistory(stakingData || []);

        // Fetch activities
        const activitiesData = await supabaseService.getUserTransactions(addr);
        setActivities(activitiesData || []);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authenticated]);

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        activeTab="Profile"
      />

      <div className="text-white min-h-screen ">
        {/* Main Content */}
        <main className=" mx-auto pt-8 sm:pt-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 sm:mb-12 px-4 sm:px-6 lg:px-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">
              Profile
            </h1>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-white border-2 border-gray-600"
              >
                <Image
                  src="/assets/user.png"
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-center sm:text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-400 text-sm sm:text-base">
                    {authenticated
                      ? "Wallet connected"
                      : "Wallet not connected"}
                  </p>
                  {authenticated ? (
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold mb-2">
                  {lexaBalance ? parseFloat(lexaBalance).toLocaleString() : "0"}{" "}
                  LEXA
                </h2>
                {authenticated && lexaBalance && (
                  <p className="text-green-400 text-sm">
                    BNB:{" "}
                    {bnbBalance ? parseFloat(bnbBalance).toLocaleString() : "0"}{" "}
                    <span className="text-gray-500">($0.00)</span>
                  </p>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className=""
          >
            <div
              className="flex items-center gap-2 sm:gap-4 rounded-t-xl p-1 w-full overflow-x-auto"
              style={{
                border: "1px solid hsl(220, 15%, 18%)",
                borderBottom: "none",
              }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("staking")}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "staking"
                    ? "text-yellow-500 bg-transparent"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                My Stakes
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("referrals")}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "referrals"
                    ? "text-yellow-500 bg-transparent"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Referrals
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("activities")}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "activities"
                    ? "text-yellow-500 bg-transparent"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Activities
              </motion.button>
            </div>
          </motion.div>

          {/* Content Section */}
          <div>
            <AnimatePresence mode="wait">
              {activeTab === "staking" && (
                <StakingTab
                  isConnected={authenticated}
                  stakes={stakingHistory}
                  loading={loading}
                />
              )}
              {activeTab === "referrals" && (
                <ReferralsTab isConnected={authenticated} />
              )}
              {activeTab === "activities" && (
                <ActivitiesTab
                  isConnected={authenticated}
                  activities={activities}
                  loading={loading}
                />
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
};

export default Profile;
