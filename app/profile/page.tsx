"use client";
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import StakeHeader from "@/components/StakeHeader";
import StakingTab from "@/components/StakingTab";
import ReferralsTab from "@/components/ReferralsTab";
import ActivitiesTab from "@/components/ActivitiesTab";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("staking");
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnect = () => {
    const mockAddress = "0xAB9.....875R6";
    setWalletAddress(mockAddress);
    setIsConnected(true);
  };

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        activeTab="Profile"
      />

      <div className="text-white min-h-screen ">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 sm:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">
              Profile
            </h1>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-linear-to-br from-gray-700 to-gray-800 border-2 border-gray-600"
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
                <p className="text-gray-400 mb-1 text-sm sm:text-base">
                  {isConnected ? walletAddress : "Not Connected"}
                </p>
                <h2 className="text-4xl sm:text-5xl font-bold mb-2">$0.00</h2>
                <p className="text-green-400 text-sm">
                  +0.00% <span className="text-gray-500">($0.00)</span>
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-6 sm:mb-8"
          >
            <div
              className="flex items-center gap-2 sm:gap-4 rounded-xl p-1 w-full overflow-x-auto"
              style={{
                backgroundColor: "hsl(220, 20%, 10%)",
                border: "1px solid hsl(220, 15%, 18%)",
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
                Staking
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
          <AnimatePresence mode="wait">
            {activeTab === "staking" && <StakingTab />}
            {activeTab === "referrals" && <ReferralsTab />}
            {activeTab === "activities" && <ActivitiesTab />}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default Profile;
