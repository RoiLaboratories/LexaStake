import StakeHeader from "@/components/StakeHeader";
import { StakeTierSelector } from "./StakeTierSelector";

// Server Component - can be prerendered
export default async function StakePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Await the searchParams
  const { ref } = await searchParams;

  const tiers = [
    {
      name: "Bronze",
      minStake: "$10",
      color: "from-amber-700 to-amber-900",
      roi: { "90d": 5, "180d": 10 },
    },
    {
      name: "Silver",
      minStake: "$20",
      color: "from-gray-400 to-gray-600",
      roi: { "90d": 10, "180d": 25 },
    },
    {
      name: "Gold",
      minStake: "$50",
      color: "from-yellow-400 to-yellow-600",
      roi: { "90d": 15, "180d": 35 },
    },
  ];

  return (
    <>
      <StakeHeader showMenu={true} showConnectButton={true} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 min-h-[calc(100vh-80px)]">
        <div className="max-w-6xl mx-auto w-full">
          <h1 className="text-4xl font-bold text-white mb-12 text-center">
            Select Your Staking Tier
          </h1>
          <StakeTierSelector tiers={tiers} referrer={ref} />
        </div>
      </main>
    </>
  );
}
