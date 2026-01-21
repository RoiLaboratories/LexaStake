"use client";
import Image from "next/image";
import { motion } from "framer-motion";

const StakingTab = () => {
  const stakes: any[] = [];

  return (
    <motion.div
      key="staking"
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
      {stakes.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Amount
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Lock Period
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    ROI
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Unlock Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {stakes.map((stake, index) => (
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
                      <span className="font-medium">{stake.amount} LEXA</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium">{stake.lockPeriod}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium text-yellow-500">
                        {stake.roi}%
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-block ${
                          stake.status === "Active"
                            ? "text-green-400 border-green-400/30 bg-green-400/10"
                            : "text-gray-400 border-gray-400/30 bg-gray-400/10"
                        }`}
                      >
                        {stake.status}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="font-medium">{stake.unlockDate}</div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {stakes.map((stake, index) => (
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
                  <span className="text-gray-400 text-sm">Amount</span>
                  <span className="font-semibold">{stake.amount} LEXA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Lock Period</span>
                  <span className="font-medium">{stake.lockPeriod}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">ROI</span>
                  <span className="font-medium text-yellow-500">
                    {stake.roi}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      stake.status === "Active"
                        ? "text-green-400 border-green-400/30 bg-green-400/10"
                        : "text-gray-400 border-gray-400/30 bg-gray-400/10"
                    }`}
                  >
                    {stake.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">Unlock Date</span>
                  <span className="font-medium">{stake.unlockDate}</span>
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
              alt="No stakes"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 opacity-60"
            />
          </div>
          <h4 className="text-lg sm:text-xl font-semibold mb-2">
            No Active Stakes
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            You haven't staked any LEXA tokens yet.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StakingTab;
