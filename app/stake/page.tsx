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

      roi: 5,
    },
    {
      id: "silver",
      name: "Silver",
      minStake: "$20",
      minStakeValue: 20,
      token: "LEXA",
      roi: 8,
    },
    {
      id: "gold",
      name: "Gold",
      minStake: "$50",
      minStakeValue: 50,
      token: "LEXA",
      roi: 12,
    },
  ];

  const handleStakeClick = (tierId: string) => {
    router.push(`/stake/${tierId}`);
  };

  return (
    <>
      <StakeHeader showMenu={false} showConnectButton={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 lg:pb-20 min-h-[calc(100vh-200px)] ">
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 ">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <h2
                  className={`text-center text-xl md:text-2xl font-bold text-white mb-3`}
                  style={{ fontFamily: "serif" }}
                >
                  {tier.name.toUpperCase()}
                </h2>
                <div
                  className="relative backdrop-blur-md border-2 py-2 border-white  h-full flex flex-col justify-center items-center"
                  style={{
                    borderRadius: "60px 8px 60px 8px",
                    /* Green outer glow and subtle inner shadow */
                    boxShadow:
                      "0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 10px rgba(34, 197, 94, 0.2)",
                  }}
                >
                  <p className="text-white text-sm mb-3 font-semibold">
                    Minimum Stake
                  </p>

                  <div className="text-center mb-5">
                    <p className="text-4xl md:text-6xl font-extrabold text-white ">
                      {tier.minStake}
                    </p>
                    {tier.token && (
                      <p className="text-xl md:text-2xl font-bold text-white mt-2 tracking-[0.2em]">
                        {tier.token}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleStakeClick(tier.id)}
                    className="w-full max-w-30 px-6 py-3 bg-yellow-500 text-black rounded-md font-bold text-base hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
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
