"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import StakeHeader from "@/components/StakeHeader";

export default function StakePage() {
  const router = useRouter();

  const tiers = [
    {
      id: "bronze",
      name: "Bronze",
      minStake: "$10",
      minStakeValue: 10,
      token: "LEXA",
      color: "from-amber-700 to-amber-900",
      borderColor: "border-green-400",
      roi: 5,
    },
    {
      id: "silver",
      name: "Silver",
      minStake: "$20",
      minStakeValue: 20,
      token: "LEXA",
      color: "from-gray-400 to-gray-600",
      borderColor: "border-blue-400",
      roi: 8,
    },
    {
      id: "gold",
      name: "Gold",
      minStake: "$50",
      minStakeValue: 50,
      token: "LEXA",
      color: "from-yellow-400 to-yellow-600",
      borderColor: "border-yellow-400",
      roi: 12,
    },
  ];

  const handleStakeClick = (tierId: string) => {
    router.push(`/stake/${tierId}`);
  };

  return (
    <>
      <StakeHeader showMenu={false} showConnectButton={false} />
      <main className="min-h-screen  flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div
                  className={`relative bg-black/50 backdrop-blur-sm border-2 ${tier.borderColor} p-6 h-full flex flex-col items-center`}
                  style={{
                    borderRadius: "50px 8px 50px 8px",
                    boxShadow:
                      "0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 255, 200, 0.15)",
                  }}
                >
                  <h2
                    className={`text-2xl md:text-3xl font-bold bg-linear-to-r ${tier.color} bg-clip-text text-transparent mb-6`}
                    style={{ fontFamily: "serif" }}
                  >
                    {tier.name.toUpperCase()}
                  </h2>

                  <p className="text-white text-lg mb-4 font-semibold">
                    Minimum Stake
                  </p>

                  <div className="text-center mb-6">
                    <p className="text-5xl md:text-6xl font-bold text-white leading-none">
                      {tier.minStake}
                    </p>
                    {tier.token && (
                      <p className="text-3xl md:text-4xl font-bold text-white mt-3 tracking-[0.3em]">
                        {tier.token}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleStakeClick(tier.id)}
                    className="w-full max-w-xs px-8 py-4 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
                  >
                    Stake
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
