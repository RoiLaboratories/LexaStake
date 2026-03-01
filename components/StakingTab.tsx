"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { BrowserProvider } from "ethers";
import { stakingService } from "@/services/staking.service";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import TransactionNotification from "@/components/TransactionNotification";

interface StakingHistoryItem {
  id?: string;
  user_address: string;
  stake_index: number;
  amount: string;
  tier: "Bronze" | "Silver" | "Gold";
  lock_period: number;
  roi_percentage: number;
  start_time: number;
  lock_end_time: number;
  active?: boolean;
  tx_hash: string;
  created_at?: string;
}

interface StakingTabProps {
  isConnected: boolean;
  stakes?: StakingHistoryItem[];
  loading?: boolean;
}

const StakingTab = ({ isConnected, stakes = [], loading = false }: StakingTabProps) => {
  // Calculate total earned rewards for a stake at full maturity
  // Rewards = Principal × (ROI% ÷ 100)
  // Example: 10 LEXA at 5% = 10 × 0.05 = 0.5 LEXA total
  const calculateEarned = (stake: StakingHistoryItem): string => {
    const amount = parseFloat(stake.amount);
    const earned = (amount * stake.roi_percentage) / 100;
    // Show 2 decimal places for accuracy (0.50 not 1)
    return earned.toFixed(2);
  };

  // Calculate accrued earnings based on time elapsed
  const calculateAccruedEarned = (stake: StakingHistoryItem): string => {
    const now = Date.now() / 1000; // Current time in seconds
    const startTime = typeof stake.start_time === 'string' ? parseInt(stake.start_time) : stake.start_time; // Ensure number
    const lockDurationSeconds = stake.lock_period * 86400; // Convert days to seconds
    const elapsedSeconds = Math.min(now - startTime, lockDurationSeconds);
    const progressPercent = lockDurationSeconds > 0 ? elapsedSeconds / lockDurationSeconds : 0;

    const amount = parseFloat(stake.amount);
    const totalEarned = (amount * stake.roi_percentage) / 100;
    const accruedEarned = totalEarned * progressPercent;

    return accruedEarned.toFixed(4);
  };

  // Format duration text
  const formatDuration = (lockPeriod: number): string => {
    return `${lockPeriod} Days`;
  };

  // Format tier with APY
  const formatTier = (tier: string, roi: number): string => {
    return `${tier} (${roi}%)`;
  };

  // Format Unix timestamp to readable date
  const formatDate = (timestamp: number | string): string => {
    try {
      const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
      const date = new Date(ts * 1000);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      return "N/A";
    }
  };

  // Check if stake is unlocked
  const isUnlocked = (startTime: number | string, lockPeriod: number): boolean => {
    const start = typeof startTime === 'string' ? parseInt(startTime) : startTime;
    const lockEndTime = start + lockPeriod * 86400; // Add lock_period in seconds
    return Date.now() / 1000 > lockEndTime;
  };

  // Calculate unlock timestamp based on start time and lock period
  const getUnlockTime = (startTime: number | string, lockPeriod: number): number => {
    const start = typeof startTime === 'string' ? parseInt(startTime) : startTime;
    return start + lockPeriod * 86400;
  };

  const { user } = usePrivy();
  const { switchToBNBChain } = useWalletConnection();
  const [transactionLoading, setTransactionLoading] = useState<number | null>(null); // Track which stake is processing
  const [transactionAction, setTransactionAction] = useState<'claim' | 'restake' | 'unstake' | null>(null); // Track which action is processing
  const [transactionStatus, setTransactionStatus] = useState<{ [key: number]: 'idle' | 'loading' | 'success' | 'error' }>({});
  const [showNotification, setShowNotification] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [currentStake, setCurrentStake] = useState<StakingHistoryItem | null>(null); // Track current stake for retry
  const [isCancelled, setIsCancelled] = useState(false); // Track if transaction was cancelled
  
  // Use ref to synchronously track which stakes are being processed (state updates are async)
  const processingStakesRef = useRef<Set<number>>(new Set());

  // Close notification modal
  const closeNotification = () => {
    setShowNotification(false);
    setIsCancelled(false);
  };

  // Retry handler for cancelled transactions
  const handleRetry = () => {
    if (currentStake && transactionAction) {
      handleStakeAction(currentStake, transactionAction);
    }
  };

  // Get signer from Privy wallet
  const getSigner = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Wallet provider not available");
    }
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  };

  // Unified handler for all stake actions (claim, restake, unstake)
  const handleStakeAction = useCallback(async (stake: StakingHistoryItem, action: 'claim' | 'restake' | 'unstake', e?: React.MouseEvent) => {
    // Prevent event propagation immediately
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Guard: Check if this specific stake is already being processed
    if (processingStakesRef.current.has(stake.stake_index)) {
      return;
    }
    
    console.log(`🔄 ${action.toUpperCase()}: Starting for stake ${stake.stake_index}`);
    
    // Mark this stake as processing FIRST
    processingStakesRef.current.add(stake.stake_index);
    setTransactionLoading(stake.stake_index);
    setTransactionAction(action); // Track which action is being processed
    setCurrentStake(stake); // Store current stake for retry
    setTransactionStatus(prev => ({ ...prev, [stake.stake_index]: 'loading' }));
    setShowNotification(true);
    setNotificationStatus('loading');
    setIsCancelled(false);
    setNotificationMessage(`${action.charAt(0).toUpperCase() + action.slice(1)} in progress...`);

    try {
      // Switch to BNB Chain before executing transaction
      console.log("🔄 Switching to BNB Chain...");
      await switchToBNBChain();
      console.log("✓ Wallet switched to BNB Chain");

      let result;
      const signer = await getSigner();

      // Execute the appropriate action
      if (action === 'claim') {
        result = await stakingService.claimRewards(stake.stake_index, signer, stake.user_address);
      } else if (action === 'restake') {
        result = await stakingService.claimRewards(stake.stake_index, signer, stake.user_address);
      } else if (action === 'unstake') {
        result = await stakingService.unstake(stake.stake_index, signer);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      if (result.status) {
        setTransactionStatus(prev => ({ ...prev, [stake.stake_index]: 'success' }));
        setTransactionHash(result.hash);
        setNotificationStatus('success');
        setNotificationMessage(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`);
        
        // Reset after 3 seconds
        const timeoutId = setTimeout(() => {
          setTransactionStatus(prev => ({ ...prev, [stake.stake_index]: 'idle' }));
          setTransactionLoading(null);
          setTransactionAction(null);
          processingStakesRef.current.delete(stake.stake_index);
          closeNotification();
        }, 3000);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : `Failed to ${action}`;
      const isTxCancelled = errorMsg.includes('user rejected') || errorMsg.includes('cancelled transaction') || errorMsg.includes('User denied') || errorMsg.includes('ACTION_REJECTED');
      
      if (isTxCancelled) {
        setNotificationStatus('error');
        setNotificationMessage('Transaction cancelled. Please try again.');
        setIsCancelled(true);
      } else {
        setNotificationStatus('error');
        setNotificationMessage(errorMsg);
        setIsCancelled(false);
      }
      
      // Reset button states immediately so they revert to normal
      setTransactionStatus(prev => ({ ...prev, [stake.stake_index]: 'idle' }));
      setTransactionLoading(null);
      setTransactionAction(null);
    } finally {
      // Clean up processing ref after delay
      setTimeout(() => {
        processingStakesRef.current.delete(stake.stake_index);
      }, 5000);
    }
  }, [stakes, switchToBNBChain]);

  // Create wrapper handlers for button clicks
  const handleClaimClick = useCallback((stake: StakingHistoryItem, e?: React.MouseEvent) => {
    return handleStakeAction(stake, 'claim', e);
  }, [handleStakeAction]); // Handle action already has switchToBNBChain in dependencies

  const handleRestakeClick = useCallback((stake: StakingHistoryItem, e?: React.MouseEvent) => {
    return handleStakeAction(stake, 'restake', e);
  }, [handleStakeAction]);

  const handleUnstakeClick = useCallback((stake: StakingHistoryItem, e?: React.MouseEvent) => {
    return handleStakeAction(stake, 'unstake', e);
  }, [handleStakeAction]);

  return (
    <motion.div
      key="staking"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-[#151617] overflow-hidden"
      style={{
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      {/* Transaction Notification Modal */}
      <TransactionNotification
        isVisible={showNotification}
        status={notificationStatus}
        onClose={closeNotification}
        onRetry={handleRetry}
        errorMessage={notificationMessage}
        transactionHash={transactionHash || undefined}
        isRetryable={isCancelled}
      />

      {stakes.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Pools/Amount
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Earned So Far
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Total at Maturity
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Tier/APY
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Duration
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Start Date
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Unlock Date
                  </th>
                  <th className="text-left py-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {stakes.map((stake, index) => (
                  <motion.tr
                    key={stake.tx_hash || index}
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
                    <td className="py-6 px-8 whitespace-nowrap">
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
                              src="/assets/LexaLogo2.svg"
                              alt="LEXA"
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">LEXA/LEXA</div>
                          <div className="text-sm text-gray-400">
                            {parseFloat(stake.amount).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className="font-medium text-cyan-400">
                        {calculateAccruedEarned(stake)} LEXA
                      </span>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className="font-medium text-green-400">
                        {calculateEarned(stake)} LEXA
                      </span>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className="font-medium">{formatTier(stake.tier, stake.roi_percentage)}</span>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className="font-medium">{formatDuration(stake.lock_period)}</span>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className="font-medium text-gray-300">{formatDate(stake.start_time)}</span>
                    </td>
                    <td className="py-6 px-8 whitespace-nowrap">
                      <span className={`font-medium ${isUnlocked(stake.start_time, stake.lock_period) ? "text-green-400" : "text-orange-400"}`}>
                        {formatDate(getUnlockTime(stake.start_time, stake.lock_period))}
                      </span>
                    </td>
                    <td className="py-6 px-8">
                      <div className="flex gap-3">
                        <button 
                          type="button"
                          data-action="claim"
                          onClick={(e) => handleClaimClick(stake, e)}
                          disabled={transactionLoading === stake.stake_index}
                          className={`px-4 py-3 rounded-lg transition-all text-sm font-semibold whitespace-nowrap ${
                            transactionLoading === stake.stake_index && transactionAction === 'claim'
                              ? "bg-yellow-600 text-black cursor-wait"
                              : transactionStatus[stake.stake_index] === 'success'
                              ? "bg-green-500 text-white"
                              : transactionStatus[stake.stake_index] === 'error'
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : "bg-yellow-500 hover:bg-yellow-600 text-black"
                          }`}
                        >
                          {transactionLoading === stake.stake_index && transactionAction === 'claim' ? "Claiming..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Claimed" : "Claim"}
                        </button>
                        <button 
                          type="button"
                          data-action="restake"
                          onClick={(e) => handleRestakeClick(stake, e)}
                          disabled={transactionLoading === stake.stake_index}
                          className={`px-4 py-3 rounded-lg transition-all text-sm font-semibold whitespace-nowrap ${
                            transactionLoading === stake.stake_index && transactionAction === 'restake'
                              ? "bg-purple-700 text-white cursor-wait"
                              : transactionStatus[stake.stake_index] === 'success'
                              ? "bg-green-500 text-white"
                              : transactionStatus[stake.stake_index] === 'error'
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : "bg-purple-600 hover:bg-purple-700 text-white"
                          }`}
                        >
                          {transactionLoading === stake.stake_index && transactionAction === 'restake' ? "Processing..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Reclaimed" : "Restake"}
                        </button>
                        <button 
                          type="button"
                          data-action="unstake"
                          onClick={(e) => handleUnstakeClick(stake, e)}
                          disabled={!isUnlocked(stake.start_time, stake.lock_period) || transactionLoading === stake.stake_index}
                          className={`px-4 py-3 rounded-lg transition-all text-sm font-semibold whitespace-nowrap ${
                            transactionLoading === stake.stake_index && transactionAction === 'unstake'
                              ? "bg-blue-700 text-white cursor-wait"
                              : transactionStatus[stake.stake_index] === 'success'
                              ? "bg-green-500 text-white"
                              : transactionStatus[stake.stake_index] === 'error'
                              ? "bg-red-500 text-white hover:bg-red-600"
                              : isUnlocked(stake.start_time, stake.lock_period)
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-gray-600 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {transactionLoading === stake.stake_index && transactionAction === 'unstake' ? "Unstaking..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Unstaked" : "Unstake"}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-6">
            {stakes.map((stake, index) => (
              <motion.div
                key={stake.tx_hash || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="rounded-xl p-6 space-y-4"
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
                          src="/assets/LexaLogo2.svg"
                          alt="LEXA"
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-700 -ml-2">
                        <Image
                          src="/assets/LexaLogo2.svg"
                          alt="LEXA"
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">LEXA/LEXA</div>
                      <div className="text-sm text-gray-400">
                        {parseFloat(stake.amount).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Earned So Far</span>
                  <span className="font-medium text-cyan-400">
                    {calculateAccruedEarned(stake)} LEXA
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Total at Maturity</span>
                  <span className="font-medium text-green-400">
                    {calculateEarned(stake)} LEXA
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Tier/APY</span>
                  <span className="font-medium">{formatTier(stake.tier, stake.roi_percentage)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Duration</span>
                  <span className="font-medium">{formatDuration(stake.lock_period)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Start Date</span>
                  <span className="font-medium text-gray-300">{formatDate(stake.start_time)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Unlock Date</span>
                  <span className={`font-medium ${isUnlocked(stake.start_time, stake.lock_period) ? "text-green-400" : "text-orange-400"}`}>
                    {formatDate(getUnlockTime(stake.start_time, stake.lock_period))}
                  </span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-700">
                  <button 
                    type="button"
                    data-action="claim"
                    onClick={(e) => handleClaimClick(stake, e)}
                    disabled={transactionLoading === stake.stake_index}
                    className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm font-semibold ${
                      transactionLoading === stake.stake_index && transactionAction === 'claim'
                        ? "bg-yellow-600 text-black cursor-wait"
                        : transactionStatus[stake.stake_index] === 'success'
                        ? "bg-green-500 text-white"
                        : transactionStatus[stake.stake_index] === 'error'
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-yellow-500 hover:bg-yellow-600 text-black"
                    }`}
                  >
                    {transactionLoading === stake.stake_index && transactionAction === 'claim' ? "Claiming..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Claimed" : "Claim"}
                  </button>
                  <button 
                    type="button"
                    data-action="restake"
                    onClick={(e) => handleRestakeClick(stake, e)}
                    disabled={transactionLoading === stake.stake_index}
                    className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm font-semibold ${
                      transactionLoading === stake.stake_index && transactionAction === 'restake'
                        ? "bg-purple-700 text-white cursor-wait"
                        : transactionStatus[stake.stake_index] === 'success'
                        ? "bg-green-500 text-white"
                        : transactionStatus[stake.stake_index] === 'error'
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-purple-600 hover:bg-purple-700 text-white"
                    }`}
                  >
                    {transactionLoading === stake.stake_index && transactionAction === 'restake' ? "Processing..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Reclaimed" : "Restake"}
                  </button>
                  <button
                    type="button"
                    data-action="unstake"
                    onClick={(e) => handleUnstakeClick(stake, e)}
                    disabled={!isUnlocked(stake.start_time, stake.lock_period) || transactionLoading === stake.stake_index}
                    className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm font-semibold ${
                      transactionLoading === stake.stake_index && transactionAction === 'unstake'
                        ? "bg-blue-700 text-white cursor-wait"
                        : transactionStatus[stake.stake_index] === 'success'
                        ? "bg-green-500 text-white"
                        : transactionStatus[stake.stake_index] === 'error'
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : isUnlocked(stake.start_time, stake.lock_period)
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {transactionLoading === stake.stake_index && transactionAction === 'unstake' ? "Unstaking..." : transactionStatus[stake.stake_index] === 'success' ? "✓ Unstaked" : "Unstake"}
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
