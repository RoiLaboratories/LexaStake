"use client";
import Image from "next/image";
import { motion } from "framer-motion";

interface Referral {
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

interface ReferralsTabProps {
  isConnected: boolean;
  referrals: Referral[];
  isLoading?: boolean;
}

const ReferralsTab = ({ isConnected, referrals, isLoading = false }: ReferralsTabProps) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeLabel = (type: string, amount: string, rewardToken: string) => {
    return type === "stake" ? `${amount} LEXA Stake` : `${amount} ${rewardToken} Swap`;
  };

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
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mb-4"></div>
          <p className="text-gray-400">Loading referrals...</p>
        </div>
      ) : referrals.length > 0 ? (
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
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Claim
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral, index) => (
                  <motion.tr
                    key={referral.id || index}
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
                      <span className="font-medium text-sm">{formatAddress(referral.referredAddress)}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium text-green-400">
                        {referral.rewardAmount} {referral.rewardToken}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium text-sm">{getTypeLabel(referral.type, referral.amount, referral.rewardToken)}</span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <a
                        href={`https://bscscan.com/tx/${referral.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors text-sm"
                      >
                        View
                      </a>
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
                key={referral.id || index}
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
                    {formatAddress(referral.referredAddress)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Reward</span>
                  <span className="font-medium text-green-400">
                    {referral.rewardAmount} {referral.rewardToken}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Action</span>
                  <span className="font-medium">{getTypeLabel(referral.type, referral.amount, referral.rewardToken)}</span>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <a
                    href={`https://bscscan.com/tx/${referral.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors text-center"
                  >
                    View Tx
                  </a>
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
              ? "You have no referrals yet"
              : "Wallet not connected"}
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base max-w-md">
            {isConnected
              ? "Share your referral link from the Earn page to start inviting friends and earn rewards!"
              : "Connect your wallet to view and manage your referrals"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ReferralsTab;
