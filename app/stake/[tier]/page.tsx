"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import StakeHeader from "@/components/StakeHeader";
import { usePrivy, User } from "@privy-io/react-auth";
import { blockchainService } from "@/services/blockchain.service";
import { stakingService, StakingTier } from "@/services/staking.service";
import { priceService } from "@/services/price.service";
import { supabaseService } from "@/services/supabase.service";
import { useWalletConnection } from "@/hooks/useWalletConnection";

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

export default function StakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, user } = usePrivy();
  const { switchToBNBChain } = useWalletConnection();

  // Get referral address from URL parameter
  const referralAddress = searchParams.get("ref");
  const [stakeAmount, setStakeAmount] = useState("");
  const [duration, setDuration] = useState("90d");
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [showNotification, setShowNotification] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lexaPrice, setLexaPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [displayedStakeAmount, setDisplayedStakeAmount] = useState<string>("");
  const [tierData, setTierData] = useState<{
    bronze: { name: string; minStake: string; minStakeValue: number; token: string; color: string; roi: { "90d": number; "180d": number } };
    silver: { name: string; minStake: string; minStakeValue: number; token: string; color: string; roi: { "90d": number; "180d": number } };
    gold: { name: string; minStake: string; minStakeValue: number; token: string; color: string; roi: { "90d": number; "180d": number } };
  } | null>(null);

  // Fetch LEXA price from PancakeSwap
  useEffect(() => {
    const fetchLexaPrice = async () => {
      setIsLoadingPrice(true);
      try {
        const prices = await priceService.getPrices();
        setLexaPrice(prices.lexa);
        console.log("💰 LEXA Price fetched:", prices.lexa);
        if (prices.lexa === 0) {
          console.warn("⚠️ LEXA price is 0, validation may not work correctly");
        }
      } catch (error) {
        console.error("Error fetching LEXA price:", error);
        setLexaPrice(null);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchLexaPrice();
  }, []);

  // Fetch user's LEXA balance
  useEffect(() => {
    const addr = extractWalletAddress(user);
    if (!addr || !authenticated) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const { lexa } = await blockchainService.getLexaAndBNBBalances(addr);
        setBalance(lexa);
        console.log("📊 LEXA Balance fetched:", lexa);
      } catch (error) {
        console.error("Error fetching LEXA balance:", error);
        setBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [user, authenticated]);

  // Fetch tier configurations from smart contract
  useEffect(() => {
    const fetchTierConfigs = async () => {
      setIsLoadingTiers(true);
      try {
        const [bronzeConfig, silverConfig, goldConfig] = await Promise.all([
          stakingService.getTierConfig(0),
          stakingService.getTierConfig(1),
          stakingService.getTierConfig(2),
        ]);

        // Convert wei to USD (wei has 18 decimals)
        const weiToUsd = (wei: string) => {
          return parseInt(wei) / 1e18;
        };

        setTierData({
          bronze: {
            name: "Bronze",
            minStake: `$${weiToUsd(bronzeConfig.minStakeAmount).toFixed(2)}`,
            minStakeValue: weiToUsd(bronzeConfig.minStakeAmount),
            token: "LEXA",
            color: "from-amber-700 to-amber-900",
            roi: {
              "90d": Number(bronzeConfig.roi90days),
              "180d": Number(bronzeConfig.roi180days),
            },
          },
          silver: {
            name: "Silver",
            minStake: `$${weiToUsd(silverConfig.minStakeAmount).toFixed(2)}`,
            minStakeValue: weiToUsd(silverConfig.minStakeAmount),
            token: "LEXA",
            color: "from-gray-400 to-gray-600",
            roi: {
              "90d": Number(silverConfig.roi90days),
              "180d": Number(silverConfig.roi180days),
            },
          },
          gold: {
            name: "Gold",
            minStake: `$${weiToUsd(goldConfig.minStakeAmount).toFixed(2)}`,
            minStakeValue: weiToUsd(goldConfig.minStakeAmount),
            token: "LEXA",
            color: "from-yellow-400 to-yellow-600",
            roi: {
              "90d": Number(goldConfig.roi90days),
              "180d": Number(goldConfig.roi180days),
            },
          },
        });

        console.log("✓ Tier configurations fetched from contract");
      } catch (error) {
        console.error("Error fetching tier configs:", error);
        setTierData(null);
      } finally {
        setIsLoadingTiers(false);
      }
    };

    fetchTierConfigs();
  }, []);

  const tier = tierData ? tierData[params.tier as keyof typeof tierData] : null;

  // Get duration days for tier calculation
  const durationDays = duration === "90d" ? 90 : 180;

  useEffect(() => {
    if (!isLoadingTiers && !tier) {
      router.push("/stake");
    }
  }, [tier, router, isLoadingTiers]);

  const handleStakeMax = () => {
    if (balance !== null) {
      setStakeAmount(balance);
    }
  };

  const resetInputs = () => {
    setStakeAmount("");
    setDuration("90d");
  };

  const handleStake = async () => {
    // Prevent multiple clicks
    if (transactionStatus === "loading") return;

    // Type guard - tier should never be null here, but TypeScript needs assurance
    if (!tier) {
      setErrorMessage("Tier configuration not loaded. Please refresh the page.");
      return;
    }

    const stakeAmount_parsed = parseFloat(stakeAmount);

    // Validation: Amount format
    if (!stakeAmount || stakeAmount_parsed <= 0) {
      setErrorMessage("Please enter a valid stake amount");
      return;
    }

    // Validation: Sufficient balance
    if (balance === null || stakeAmount_parsed > parseFloat(balance)) {
      setErrorMessage("Insufficient LEXA balance");
      return;
    }

    // Validation: Price is loaded
    if (lexaPrice === null || lexaPrice === 0) {
      setErrorMessage("Unable to verify tier minimum. Please refresh and try again.");
      return;
    }

    // Validation: Minimum USD value for tier
    const stakeUsdValue = stakeAmount_parsed * lexaPrice;
    if (stakeUsdValue < tier.minStakeValue) {
      const requiredLexaAmount = (tier.minStakeValue / lexaPrice).toFixed(2);
      setErrorMessage(
        `Minimum ${tier.name} stake: $${tier.minStakeValue} USD (~${requiredLexaAmount} LEXA at current price)`
      );
      return;
    }

    if (!user?.wallet) {
      setErrorMessage("Wallet not connected");
      return;
    }

    setTransactionStatus("loading");
    setShowNotification(true);
    setErrorMessage("");

    try {
      // Switch to BNB Chain before staking
      console.log("🔄 Switching to BNB Chain...");
      await switchToBNBChain();
      console.log("✓ Wallet switched to BNB Chain");

      // Get signer from window.ethereum (injected by Privy)
      if (!window.ethereum) {
        throw new Error("Ethereum provider not available. Please ensure Privy wallet is properly connected.");
      }

      console.log("🔗 Initializing BrowserProvider with window.ethereum...");

      const { BrowserProvider, ethers } = await import("ethers");
      let signer;
      
      try {
        const provider = new BrowserProvider(window.ethereum);
        console.log("✓ BrowserProvider created");
        
        // Try to get the signer - this may trigger RPC calls
        signer = await provider.getSigner();
        console.log("✓ Signer obtained");
      } catch (providerError) {
        console.error("❌ Provider/Signer error:", providerError);
        throw new Error(`Failed to connect to wallet provider: ${providerError instanceof Error ? providerError.message : String(providerError)}`);
      }

      if (!signer) {
        throw new Error("Could not obtain wallet signer. Please ensure your wallet is unlocked.");
      }

      // Convert amount to wei (18 decimals)
      const amountInWei = ethers.parseEther(stakeAmount);

      // Map duration to days
      const durationDays = duration === "90d" ? 90 : 180;

      // Map tier name to enum
      const tierMap: Record<string, StakingTier> = {
        bronze: StakingTier.BRONZE,
        silver: StakingTier.SILVER,
        gold: StakingTier.GOLD,
      };

      const tierEnum = tierMap[params.tier as string] ?? StakingTier.BRONZE;

      // Call staking service - pass ethers signer
      const result = await stakingService.stake(
        {
          amount: amountInWei,
          tier: tierEnum,
          durationDays,
          referrer: referralAddress || undefined, // Use referral address from URL if available
        },
        signer  // Pass ethers signer from BrowserProvider
      );

      if (result.status) {
        // Capture values before clearing inputs
        setDisplayedStakeAmount(stakeAmount);
        setTransactionHash(result.hash);
        setTransactionStatus("success");
        setStakeAmount("");
        setDuration("90d");

        // Get the wallet address
        const walletAddr = await signer.getAddress();
        console.log("✓ Stake completed, tx hash:", result.hash);

        // Get current stake count to determine stake_index
        try {
          console.log("📊 Fetching stake index...");
          const stakeCount = await stakingService.getUserStakeCount(walletAddr);
          
          // If stakeCount is 0, it likely means the contract call failed or it's a new user
          // Still attempt to get details with index 0
          const stakeIndex = Math.max(0, stakeCount - 1); // Latest stake is at count - 1

          // Get stake details from contract
          const stakeDetails = await stakingService.getStakeDetails(
            walletAddr,
            stakeIndex
          );

          // Determine tier name
          const tierNames: Record<number, "Bronze" | "Silver" | "Gold"> = {
            0: "Bronze",
            1: "Silver",
            2: "Gold",
          };
          const tierName = tierNames[stakeDetails.tier] || "Bronze";

          // Calculate ROI percentage based on tier and duration
          const roiMap: Record<string, Record<number, number>> = {
            Bronze: { 90: 5, 180: 10 },
            Silver: { 90: 10, 180: 25 },
            Gold: { 90: 15, 180: 35 },
          };
          const roiPercentage = roiMap[tierName][durationDays] || 0;

          // Save to Supabase
          console.log("💾 Saving staking record to Supabase...");
          const dbResult = await supabaseService.recordStaking(
            {
              user_address: walletAddr,
              stake_index: stakeIndex,
              amount: stakeAmount,
              tier: tierName,
              lock_period: durationDays,
              roi_percentage: roiPercentage,
              start_time: Math.floor(Date.now() / 1000),
              lock_end_time: stakeDetails.lockEndTime,
              tx_hash: result.hash,
            },
            walletAddr
          );

          if (dbResult.success) {
            console.log("✓ Staking record saved to Supabase");

            // Record referral if one exists
            if (referralAddress && referralAddress !== walletAddr) {
              try {
                console.log("📊 Recording referral conversion...");
                const referralResult = await supabaseService.recordReferral(
                  referralAddress,
                  walletAddr,
                  stakeAmount,
                  result.hash
                );
                if (referralResult.success) {
                  console.log("✓ Referral recorded successfully");
                } else {
                  console.warn("⚠️ Failed to record referral:", referralResult.error);
                }
              } catch (referralError) {
                console.warn("⚠️ Error recording referral:", referralError);
              }
            }
          } else {
            console.warn(
              "⚠️ Failed to save staking record:",
              dbResult.error
            );
          }
        } catch (dbError) {
          console.error("⚠️ Error saving to Supabase:", dbError);
          // Don't fail the UX if database save fails
        }

        // Refetch balance after successful stake
        setTimeout(() => {
          const addr = extractWalletAddress(user);
          if (addr && authenticated) {
            blockchainService
              .getLexaAndBNBBalances(addr)
              .then(({ lexa }) => setBalance(lexa))
              .catch((err) => console.error("Failed to refetch balance:", err));
          }
        }, 2000);
      } else {
        setTransactionStatus("error");
        setErrorMessage("Transaction failed. Please try again.");
      }
    } catch (error: any) {
      setTransactionStatus("error");
      const errorMsg =
        error?.message || "An error occurred during staking. Please try again.";
      setErrorMessage(errorMsg);
      console.error("Staking error:", error);
    }

    // Auto-hide notification after 8 seconds
    setTimeout(() => {
      setShowNotification(false);
      setTransactionStatus("idle");
    }, 8000);
  };

  const closeNotification = () => {
    setShowNotification(false);
    setTransactionStatus("idle");
  };

  // Calculate if stake button should be enabled
  const canStake = tier &&
    stakeAmount && 
    parseFloat(stakeAmount) > 0 &&
    balance !== null && 
    parseFloat(stakeAmount) <= parseFloat(balance) &&
    lexaPrice !== null &&
    lexaPrice > 0 &&
    (parseFloat(stakeAmount) * lexaPrice) >= tier.minStakeValue;

  // Get current ROI based on selected duration
  const currentROI = tier ? tier.roi[duration as keyof typeof tier.roi] : null;

  if (isLoadingTiers) {
    return (
      <>
        <StakeHeader showMenu={true} showConnectButton={true} />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading tier configuration...</p>
          </div>
        </div>
      </>
    );
  }

  if (!tier) return null;

  return (
    <>
      <StakeHeader
        showMenu={true}
        showConnectButton={true}
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
                  {errorMessage || "Failed to complete the staking transaction. Please try again."}
                </p>
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
                  Staked {parseFloat(displayedStakeAmount).toLocaleString()} LEXA for{" "}
                  {duration === "90d" ? "90" : "180"} days to get {currentROI}%
                  ROI claimable daily
                </p>
                <a
                  href={`https://bscscan.com/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors inline-block text-center"
                >
                  View transaction ↗
                </a>
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
              <div className="flex gap-2 items-center">
                <button
                  onClick={resetInputs}
                  className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                  title="Reset inputs"
                >
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </button>
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
                  placeholder={`0    (Min $${tier.minStakeValue} USD)`}
                  className="bg-transparent text-3xl text-gray-400 font-bold outline-none w-full placeholder:text-gray-600"
                />
                <span className="text-xl font-bold text-white ml-4">LEXA</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-5">
              <div>
                <div className="text-gray-400 font-semibold text-sm">
                  Balance: {isLoadingBalance ? "Loading..." : balance !== null ? parseFloat(balance).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0"} LEXA
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {isLoadingPrice ? (
                    "Loading price..."
                  ) : lexaPrice === null || lexaPrice === 0 ? (
                    <span className="text-red-400">⚠️ Price unavailable</span>
                  ) : (
                    <>
                      LEXA: ${lexaPrice.toFixed(4)} USD
                      {balance && (
                        <span className="text-yellow-400 ml-2">
                          ≈ ${(parseFloat(balance) * lexaPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={handleStakeMax}
                disabled={balance === null || parseFloat(balance) === 0}
                className="px-3 py-1.5 border-2 border-yellow-500 text-yellow-500 rounded-xs font-bold hover:bg-yellow-500 hover:text-black transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stake Max
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-400 text-base">
                ROI: <span className="text-white font-bold">{currentROI}%</span>
              </p>
              {stakeAmount && lexaPrice && lexaPrice > 0 && (
                <p className="text-gray-500 text-sm mt-2">
                  Staking Value: <span className="text-yellow-400 font-semibold">
                    ${(parseFloat(stakeAmount) * lexaPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
                  </span>
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleStake}
                disabled={!canStake || transactionStatus === "loading"}
                className={`w-3/4 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                  canStake && transactionStatus !== "loading"
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/50 cursor-pointer"
                    : "bg-yellow-600 text-black cursor-not-allowed opacity-70"
                }`}
              >
                {transactionStatus === "loading" ? "Processing..." : "Stake Now"}
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
