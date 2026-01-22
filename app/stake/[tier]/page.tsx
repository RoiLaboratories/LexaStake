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
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [showNotification, setShowNotification] = useState(false);
  const balance = 100000;

  const tierData = {
    bronze: {
      name: "Bronze",
      minStake: "$10",
      minStakeValue: 10,
      token: "LEXA",
      color: "from-amber-700 to-amber-900",
      roi: {
        "90d": 5,
        "180d": 10,
      },
    },
    silver: {
      name: "Silver",
      minStake: "$20",
      minStakeValue: 20,
      token: "LEXA",
      color: "from-gray-400 to-gray-600",
      roi: {
        "90d": 10,
        "180d": 25,
      },
    },
    gold: {
      name: "Gold",
      minStake: "$50",
      minStakeValue: 50,
      token: "LEXA",
      color: "from-yellow-400 to-yellow-600",
      roi: {
        "90d": 15,
        "180d": 35,
      },
    },
  };

  const tier = tierData[params.tier as keyof typeof tierData];

  useEffect(() => {
    if (!tier) {
      router.push("/stake");
    }
  }, [tier, router]);

  const handleConnect = () => {
    const mockAddress = "0xAB9.....875R6";
    setWalletAddress(mockAddress);
    setIsConnected(true);
  };

  const handleStakeMax = () => {
    if (isConnected) {
      setStakeAmount(balance.toString());
    }
  };

  const handleStake = async () => {
    // Prevent multiple clicks
    if (transactionStatus === "loading") return;

    setTransactionStatus("loading");
    setShowNotification(true);

    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate success or failure (you can add your actual logic here)
    const stakeValue = parseFloat(stakeAmount);
    if (stakeValue > balance) {
      setTransactionStatus("error");
    } else {
      setTransactionStatus("success");
    }

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
      setTransactionStatus("idle");
    }, 5000);
  };

  const closeNotification = () => {
    setShowNotification(false);
    setTransactionStatus("idle");
  };

  const canStake =
    isConnected && stakeAmount && parseFloat(stakeAmount) >= tier.minStakeValue;

  // Get current ROI based on selected duration
  const currentROI = tier.roi[duration as keyof typeof tier.roi];

  if (!tier) return null;

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
        walletAddress={walletAddress}
        onConnect={handleConnect}
      />

      {/* Transaction Notifications */}
      {showNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`relative rounded-xl p-5 ${
              transactionStatus === "loading"
                ? "bg-gray-900 border-2 "
                : transactionStatus === "success"
                  ? "bg-gray-900 border-2 "
                  : "bg-gray-900 border-2 "
            }`}
          >
            {/* Close button */}
            {transactionStatus !== "loading" && (
              <button
                onClick={closeNotification}
                className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}

            {/* Loading State */}
            {transactionStatus === "loading" && (
              <div className="text-center">
                <div className="inline-block w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <h3 className="text-lg font-bold text-white">
                  Transaction Loading...
                </h3>
              </div>
            )}

            {/* Error State */}
            {transactionStatus === "error" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Token staking failed!
                  </h3>
                </div>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Insufficient balance to perform the stake, deposit LEXA to
                  continue
                </p>
                <button className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
                  View transaction
                </button>
              </div>
            )}

            {/* Success State */}
            {transactionStatus === "success" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Token staked successfully!
                  </h3>
                </div>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  Staked {parseFloat(stakeAmount).toLocaleString()} LEXA for{" "}
                  {duration === "90d" ? "90" : "180"} days to get {currentROI}%
                  ROI claimable daily
                </p>
                <button className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
                  View transaction
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 lg:pb-20 min-h-[calc(100vh-200px)] py-20">
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
                  className={`px-4 py-2 rounded-sm font-bold transition-all text-sm ${
                    duration === "90d"
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  90d
                </button>
                <button
                  onClick={() => setDuration("180d")}
                  className={`px-4 py-2 rounded-sm font-bold transition-all text-sm ${
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
                className="px-3 py-1.5 border-2 border-yellow-500 text-yellow-500 rounded-xs font-bold hover:bg-yellow-500 hover:text-black transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stake Max
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-400 text-base">
                ROI: <span className="text-white font-bold">{currentROI}%</span>
              </p>
            </div>
            <div className="flex justify-center">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  className="w-3/4 px-6 py-4 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                >
                  Connect wallet
                </button>
              ) : (
                <button
                  onClick={handleStake}
                  disabled={!canStake || transactionStatus === "loading"}
                  className={`w-3/4 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                    canStake && transactionStatus !== "loading"
                      ? "bg-yellow-500 text-black hover:bg-yellow-400 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                      : "bg-yellow-600 text-black cursor-not-allowed opacity-70"
                  }`}
                >
                  {transactionStatus === "loading"
                    ? "Processing..."
                    : "Stake Now"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
