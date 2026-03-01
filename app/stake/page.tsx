"use client";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import StakeHeader from "@/components/StakeHeader";
import { usePrivy, User } from "@privy-io/react-auth";

// Prevent prerendering since this page uses useSearchParams (referral link)
export const dynamic = "force-dynamic";

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

export default function StakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, user } = usePrivy();

  // Get referral address from URL parameter
  const referralAddress = searchParams.get("ref");

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
    const url = `/stake/${tierId}${referralAddress ? `?ref=${referralAddress}` : ""}`;
    router.push(url);
  };

  return (
    <>
      <StakeHeader showMenu={true} showConnectButton={true} activeTab="Stake" />
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-[calc(100vh-80px)]">
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <h2
                  className="text-center text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3"
                  style={{ fontFamily: "serif" }}
                >
                  {tier.name.toUpperCase()}
                </h2>
                <div
                  className="relative backdrop-blur-md border-2 px-4 py-6 sm:py-8 border-white flex flex-col justify-center items-center"
                  style={{
                    borderRadius: "40px 8px 40px 8px",
                    boxShadow:
                      "0 0 20px rgba(34, 197, 94, 0.4), inset 0 0 10px rgba(34, 197, 94, 0.2)",
                  }}
                >
                  <p className="text-white text-xs sm:text-sm mb-2 sm:mb-3 font-semibold">
                    Minimum Stake
                  </p>

                  <div className="text-center mb-4 sm:mb-5">
                    <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white">
                      {tier.minStake}
                    </p>
                    {tier.token && (
                        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mt-1 sm:mt-2 tracking-[0.2em]">
                          {tier.token}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleStakeClick(tier.id)}
                      className="w-full max-w-40 px-6 py-2.5 sm:py-3 bg-yellow-500 text-black rounded-md font-bold text-sm sm:text-base hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
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
