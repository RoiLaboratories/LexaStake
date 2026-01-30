"use client";
import Image from "next/image";
import { motion } from "framer-motion";

interface StakingTabProps {
  isConnected: boolean;
}

const StakingTab = ({ isConnected }: StakingTabProps) => {
  // Mock data when wallet is connected
  const stakes = isConnected
    ? [
        {
          pools: "LEXA/LEXA",
          amount: "20000",
          earned: "10000",
          tier: "Bronze (5%)",
          duration: "90 Days",
          claim: true,
          restake: true,
        },
        {
          pools: "LEXA/LEXA",
          amount: "10000",
          earned: "5000",
          tier: "Bronze (10%)",
          duration: "180 Days",
          claim: true,
          restake: true,
        },
        {
          pools: "LEXA/LEXA",
          amount: "5000",
          earned: "2000",
          tier: "Silver (10%)",
          duration: "90 Days",
          claim: true,
          restake: true,
        },
      ]
    : [];

  return (
    <motion.div
      key="staking"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className=" overflow-hidden"
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
                    Pools/Amount
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Earned
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Tier/APY
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Duration
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Claim
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Restake
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
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-700">
                            <Image
                              src="/assets/LexaLogo2.svg"
                              alt="LEXA"
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-700 -ml-2">
                            <Image
                              src="/assets/bnb.svg"
                              alt="BNB"
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">{stake.pools}</div>
                          <div className="text-sm text-gray-400">
                            {stake.amount}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium text-green-400">
                        {stake.earned}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium">{stake.tier}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className="font-medium">{stake.duration}</span>
                    </td>
                    <td className="py-5 px-6">
                      <button className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                        Claim
                      </button>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <button className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                        Restake
                      </button>
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
                  <span className="text-gray-400 text-sm">Pools/Amount</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-700">
                        <Image
                          src="/assets/lexa-icon.png"
                          alt="LEXA"
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-700 -ml-2">
                        <Image
                          src="/assets/lexa-icon.png"
                          alt="LEXA"
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{stake.pools}</div>
                      <div className="text-sm text-gray-400">
                        {stake.amount}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Earned</span>
                  <span className="font-medium text-green-400">
                    {stake.earned}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Tier/APY</span>
                  <span className="font-medium">{stake.tier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Duration</span>
                  <span className="font-medium">{stake.duration}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-700">
                  <button className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                    Claim
                  </button>
                  <button className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors">
                    Restake
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
              alt="No stakes"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 opacity-60"
            />
          </div>
          <h4 className="text-lg sm:text-xl font-semibold mb-2">
            {isConnected ? "No Active Stakes" : "Wallet not connected"}
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            {isConnected
              ? "You haven't staked any LEXA tokens yet."
              : "Connect wallet with stakes to view your stakes"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StakingTab;
