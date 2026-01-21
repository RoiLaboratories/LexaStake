"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import StakeHeader from "@/components/StakeHeader";

export default function StakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [stakeAmount, setStakeAmount] = useState("");
  const [duration, setDuration] = useState("90d");
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const balance = 100000;

  const tierData = {
    bronze: {
      name: "Bronze",
      minStake: "$10",
      minStakeValue: 10,
      token: "LEXA",
      color: "from-amber-700 to-amber-900",
      roi: 5,
    },
    silver: {
      name: "Silver",
      minStake: "$20",
      minStakeValue: 20,
      token: "LEXA",
      color: "from-gray-400 to-gray-600",
      roi: 8,
    },
    gold: {
      name: "Gold",
      minStake: "$50",
      minStakeValue: 50,
      token: "LEXA",
      color: "from-yellow-400 to-yellow-600",
      roi: 12,
    },
  };

  const tier = tierData[params.tier as keyof typeof tierData];

  useEffect(() => {
    if (!tier) {
      router.push("/stake");
    }
  }, [tier, router]);

  const handleConnect = () => {
    // Simulate wallet connection
    const mockAddress = "0xAB9.....875R6";
    setWalletAddress(mockAddress);
    setIsConnected(true);
  };

  const handleStakeMax = () => {
    if (isConnected) {
      setStakeAmount(balance.toString());
    }
  };

  const canStake =
    isConnected && stakeAmount && parseFloat(stakeAmount) >= tier.minStakeValue;

  if (!tier) return null;

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
      />
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-yellow-600/50 rounded-3xl p-6 bg-black/40 backdrop-blur-sm"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {tier.name} Stake
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setDuration("90d")}
                  className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                    duration === "90d"
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  90d
                </button>
                <button
                  onClick={() => setDuration("180d")}
                  className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                    duration === "180d"
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  180d
                </button>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-2xl p-5 mb-4">
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder={`0    (Min $${tier.minStakeValue} LEXA)`}
                  disabled={!isConnected}
                  className="bg-transparent text-3xl text-gray-400 font-bold outline-none w-full placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xl font-bold text-white ml-4">LEXA</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-5">
              <span className="text-gray-400 font-semibold text-sm">
                Balance: {isConnected ? balance.toLocaleString() : "0"} LEXA
              </span>
              <button
                onClick={handleStakeMax}
                disabled={!isConnected}
                className="px-3 py-1.5 border-2 border-yellow-500 text-yellow-500 rounded-lg font-bold hover:bg-yellow-500 hover:text-black transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stake Max
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-400 text-base">
                ROI: <span className="text-white font-bold">{tier.roi}%</span>
              </p>
            </div>

            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="w-full px-6 py-4 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50"
              >
                Connect wallet
              </button>
            ) : (
              <button
                disabled={!canStake}
                className={`w-full px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                  canStake
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                    : "bg-yellow-600 text-black cursor-not-allowed opacity-70"
                }`}
              >
                Stake Now
              </button>
            )}
          </motion.div>
        </div>
      </main>
    </>
  );
}
