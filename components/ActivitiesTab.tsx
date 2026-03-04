"use client";
import Image from "next/image";
import { motion } from "framer-motion";

interface ActivityItem {
  id?: string;
  user_address: string;
  tx_hash: string;
  tx_type: "stake" | "unstake" | "claim_rewards" | "restake" | "swap";
  status?: "pending" | "confirmed" | "failed";
  amount?: string;
  details?: Record<string, any>;
  created_at?: string;
}

interface ActivitiesTabProps {
  isConnected: boolean;
  activities?: ActivityItem[];
  loading?: boolean;
}

const ActivitiesTab = ({ isConnected, activities = [], loading = false }: ActivitiesTabProps) => {
  // Format activity action description from transaction data
  const formatActionDescription = (activity: ActivityItem): string => {
    const amount = activity.amount ? parseFloat(activity.amount).toLocaleString() : "0";
    
    switch (activity.tx_type) {
      case "stake":
        return `Staked ${amount} LEXA`;
      case "unstake":
        return `Unstaked ${amount} LEXA`;
      case "claim_rewards":
        return `Claimed ${amount} LEXA rewards`;
      case "restake":
        return `Restaked ${amount} LEXA`;
      case "swap":
        return `Swapped ${activity.details?.fromSymbol || "tokens"} for ${activity.details?.toSymbol || "LEXA"}`;
      default:
        return "Transaction";
    }
  };

  // Format timestamp to readable date and time
  const formatDateTime = (createdAt?: string): string => {
    if (!createdAt) return "N/A";
    
    try {
      const date = new Date(createdAt);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return "N/A";
    }
  };

  // Map database status to display status
  const formatStatus = (status?: string): string => {
    switch (status) {
      case "confirmed":
        return "Successful";
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
      default:
        return "Unknown";
    }
  };

  return (
    <motion.div
      key="activities"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden bg-[#151617]"
      style={{
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      {activities.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full ">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Action
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                    Date & Time
                  </th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, index) => {
                  const displayStatus = formatStatus(activity.status);
                  const isSuccess = activity.status === "confirmed";
                  return (
                    <motion.tr
                      key={activity.tx_hash || index}
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
                      <td className="py-5 px-6">
                        <span className="font-medium">{formatActionDescription(activity)}</span>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-gray-400 text-sm">{formatDateTime(activity.created_at)}</span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`font-medium ${
                              isSuccess
                                ? "text-green-400"
                                : activity.status === "pending"
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }`}
                          >
                            {displayStatus}
                          </span>
                          {isSuccess ? (
                            <svg
                              className="w-5 h-5 text-green-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4 p-4">
            {activities.map((activity, index) => {
              const displayStatus = formatStatus(activity.status);
              const isSuccess = activity.status === "confirmed";
              return (
                <motion.div
                  key={activity.tx_hash || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="rounded-xl p-4 space-y-3"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Action</span>
                    <span className="font-semibold text-right max-w-50">
                      {formatActionDescription(activity)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                    <span className="text-gray-400 text-sm">Date & Time</span>
                    <span className="text-gray-400 text-sm text-right">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                    <span className="text-gray-400 text-sm">Status</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          isSuccess
                            ? "text-green-400"
                            : activity.status === "pending"
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {displayStatus}
                      </span>
                      {isSuccess ? (
                        <svg
                          className="w-5 h-5 text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })}
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
              alt="No activities"
              width={80}
              height={80}
              className="w-16 h-16 sm:w-20 sm:h-20 opacity-60"
            />
          </div>
          <h4 className="text-lg sm:text-xl font-semibold mb-2">
            {isConnected ? "No Activities" : "Wallet not connected"}
          </h4>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            {isConnected
              ? "Your transaction history will appear here."
              : "Connect wallet with transactions to view your activities"}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ActivitiesTab;
