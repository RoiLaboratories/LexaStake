"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, User } from "@privy-io/react-auth";
import { Upload } from "lucide-react";
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
  details?: Record<string, unknown>;
  created_at?: string;
}

interface ReferralItem {
  id?: string;
  referredAddress: string;
  type: "stake" | "swap";
  amount: string;
  rewardAmount: string;
  rewardToken: "LEXA" | "BNB" | "USDT";
  status: "pending" | "completed" | "failed";
  txHash: string;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState("stakes");
  const [lexaBalance, setLexaBalance] = useState<string | null>(null);
  const [bnbBalance, setBnbBalance] = useState<string | null>(null);
  const [stakingHistory, setStakingHistory] = useState<StakingHistoryItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { authenticated, user } = usePrivy();

  useEffect(() => {
    const addr = extractWalletAddress(user);
    if (!addr || !authenticated) {
      setLexaBalance(null);
      setBnbBalance(null);
      setStakingHistory([]);
      setReferrals([]);
      setActivities([]);
      setProfileImage(null);
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

        // Fetch referrals
        const referralsData = await supabaseService.getUserReferrals(addr);
        setReferrals(referralsData || []);

        // Fetch activities
        const activitiesData = await supabaseService.getUserTransactions(addr);
        setActivities(activitiesData || []);

        // Fetch profile image
        const imageUrl = await supabaseService.getProfileImage(addr);
        if (imageUrl) {
          setProfileImage(imageUrl);
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authenticated]);

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    const addr = extractWalletAddress(user);
    if (!addr) {
      alert("Wallet address not found");
      return;
    }

    setUploadingImage(true);
    try {
      const result = await supabaseService.uploadProfileImage(addr, file);
      if (result.success && result.url) {
        setProfileImage(result.url);
        console.log("✓ Profile image uploaded successfully");
      } else {
        alert(`Failed to upload image: ${result.error}`);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        activeTab="Profile"
      />

      <div className="text-white min-h-screen ">
        {/* Main Content */}
        <main className=" mx-auto pt-4 sm:pt-6">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 sm:mb-6 px-4 sm:px-6 lg:px-8"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">
              Profile
            </h1>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-white border-2 border-gray-600 group cursor-pointer"
                onClick={handleImageUploadClick}
              >
                <Image
                  src={profileImage || "/assets/user.png"}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
                
                {/* Upload overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center"
                >
                  <motion.div
                    className="flex flex-col items-center gap-1"
                  >
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    <span className="text-white text-xs font-semibold">Upload</span>
                  </motion.div>
                </motion.div>

                {/* Loading overlay */}
                {uploadingImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/80 flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-yellow-500 rounded-full"
                    />
                  </motion.div>
                )}
              </motion.div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
                disabled={uploadingImage}
              />

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
                onClick={() => setActiveTab("stakes")}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base whitespace-nowrap ${
                  activeTab === "stakes"
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
              {activeTab === "referrals" && (
                <ReferralsTab isConnected={authenticated} referrals={referrals} isLoading={loading} />
              )}
              {activeTab === "stakes" && (
                <StakingTab
                  isConnected={authenticated}
                  stakes={stakingHistory}
                  loading={loading}
                />
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
