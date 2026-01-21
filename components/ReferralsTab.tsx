"use client";
import Image from "next/image";
import { motion } from "framer-motion";

const ReferralsTab = () => {
  const referrals: any[] = [];

  return (
    <motion.div
      key="referrals"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "hsl(220, 20%, 10%)",
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
                    User
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Amount Staked
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Your Earnings
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Date Joined
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
                      <span className="font-medium">{referral.user}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium">
                        {referral.amountStaked} LEXA
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium text-yellow-500">
                        {referral.earnings} LEXA
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="font-medium">{referral.dateJoined}</div>
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
                  <span className="text-gray-400 text-sm">User</span>
                  <span className="font-semibold">{referral.user}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Amount Staked</span>
                  <span className="font-medium">
                    {referral.amountStaked} LEXA
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Your Earnings</span>
                  <span className="font-medium text-yellow-500">
                    {referral.earnings} LEXA
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">Date Joined</span>
                  <span className="font-medium">{referral.dateJoined}</span>
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
            No Referrals Yet
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            Share your referral link to start earning rewards.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ReferralsTab;
