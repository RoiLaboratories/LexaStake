"use client";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface StakeTierSelectorProps {
  tiers: Array<{
    name: string;
    minStake: string;
    roi: { "90d": number; "180d": number };
    color: string;
  }>;
  referrer?: string;
}

function StakeTierSelectorContent({ tiers, referrer }: StakeTierSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralAddress = searchParams.get("ref") || referrer;

  const handleSelectTier = (tierName: string) => {
    const tierPath = `/stake/${tierName.toLowerCase()}`;
    if (referralAddress) {
      router.push(`${tierPath}?ref=${referralAddress}`);
    } else {
      router.push(tierPath);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
      {tiers.map((tier, index) => (
        <motion.button
          key={index}
          onClick={() => handleSelectTier(tier.name)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${tier.color} hover:shadow-2xl transition-all duration-300 border border-opacity-20 border-white`}
        >
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-white mb-4">{tier.name}</h3>
            <div className="space-y-3 text-left text-white text-opacity-90">
              <p className="text-sm">
                Minimum Stake: <span className="font-semibold">{tier.minStake}</span>
              </p>
              <div className="pt-4 border-t border-white border-opacity-20">
                <p className="text-sm font-semibold mb-2">ROI:</p>
                <p className="text-xs">90 days: {tier.roi["90d"]}%</p>
                <p className="text-xs">180 days: {tier.roi["180d"]}%</p>
              </div>
            </div>
            <div className="mt-6 inline-flex items-center text-white font-semibold group-hover:translate-x-1 transition-transform">
              Select {tier.name} <span className="ml-2">→</span>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

export function StakeTierSelector(props: StakeTierSelectorProps) {
  return (
    <Suspense fallback={<div className="text-gray-400">Loading tiers...</div>}>
      <StakeTierSelectorContent {...props} />
    </Suspense>
  );
}
