"use client";
import { motion } from "framer-motion";

export default function StakePage() {
  const tiers = [
    {
      name: "Bronze",
      minStake: "$10",
      token: "LEXA",
      color: "from-amber-700 to-amber-900",
      borderColor: "border-green-500",
    },
    {
      name: "Silver",
      minStake: "10K",
      token: "",
      color: "from-gray-400 to-gray-600",
      borderColor: "border-green-500",
    },
    {
      name: "Gold",
      minStake: "50K",
      token: "",
      color: "from-yellow-400 to-yellow-600",
      borderColor: "border-green-500",
    },
  ];

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              {/* Card */}
              <div
                className={`relative bg-black/60 backdrop-blur-sm rounded-3xl border-2 ${tier.borderColor} p-8 h-full flex flex-col items-center`}
              >
                {/* Tier Name */}
                <h2
                  className={`text-3xl md:text-4xl font-bold bg-linear-to-r ${tier.color} bg-clip-text text-transparent mb-8 font-cinzel`}
                >
                  {tier.name.toUpperCase()}
                </h2>

                {/* Minimum Stake Label */}
                <p className="text-white text-lg mb-4">Minimum Stake</p>

                {/* Amount */}
                <div className="text-center mb-8">
                  <p className="text-6xl md:text-7xl font-bold text-white leading-none">
                    {tier.minStake}
                  </p>
                  {tier.token && (
                    <p className="text-3xl md:text-4xl font-bold text-white mt-2 tracking-widest">
                      {tier.token}
                    </p>
                  )}
                </div>

                {/* Stake Button */}
                <button className="w-full max-w-50 px-8 py-4 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50">
                  Stake
                </button>

                {/* Glow effect on hover */}
                <div
                  className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-linear-to-r ${tier.color} blur-xl -z-10`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
