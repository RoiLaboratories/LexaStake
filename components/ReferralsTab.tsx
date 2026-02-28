"use client";
import Image from "next/image";
import { motion } from "framer-motion";

interface ReferralsTabProps {
  isConnected: boolean;
}

const ReferralsTab = ({ isConnected }: ReferralsTabProps) => {
  // TODO: Implement referral data fetching when referral tracking is added
  const referrals: any[] = [];

  return (
    <motion.div
      key="referrals"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-[#151617] overflow-hidden"
      style={{
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      {referrals.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Address
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Reward
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Action
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Claim
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileHover={{
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                    }}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <td className="py-5 px-6">
                      <span className="font-medium">{referral.address}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span
                        className={`font-medium ${
                          referral.reward.includes("LEXA")
                            ? "text-green-400"
                            : "text-green-400"
                        }`}
                      >
                        {referral.reward}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium">{referral.action}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span
                        className={`px-3 py-1.5 rounded-full text-sm font-medium inline-block ${
                          referral.status === "Active"
                            ? "text-green-400 bg-green-400/10"
                            : "text-green-400 bg-green-400/10"
                        }`}
                      >
                        {referral.status}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <button className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                        Claim
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {referrals.map((referral, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="rounded-xl p-4 space-y-3"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Address</span>
                  <span className="font-semibold text-sm">
                    {referral.address}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Reward</span>
                  <span className="font-medium text-green-400">
                    {referral.reward}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Action</span>
                  <span className="font-medium">{referral.action}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      referral.status === "Active"
                        ? "text-green-400 bg-green-400/10"
                        : "text-green-400 bg-green-400/10"
                    }`}
                  >
                    {referral.status}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <button className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                    Claim
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 px-4 sm:px-6"
        >
          <div className="mb-4 sm:mb-6">
            <Image
              src="/assets/wallet.png"
              alt="No referrals"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 opacity-60"
            />
          </div>
          <h4 className="text-lg sm:text-xl font-semibold mb-2">
            {isConnected
              ? "You have no active referrals"
              : "Wallet not connected"}
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            {isConnected
              ? "Invite friends with your referral link to view your referrals"
              : "Connect wallet with referrals to view your referrals"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ReferralsTab;
