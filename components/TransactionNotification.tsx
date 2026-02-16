// components/swap/TransactionNotification.tsx
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { TransactionStatus } from "@/types/swap.types";

interface TransactionNotificationProps {
  isVisible: boolean;
  status: TransactionStatus;
  sellAmount?: string;
  sellToken?: string;
  receiveAmount?: string;
  receiveToken?: string;
  transactionHash?: string;
  onClose: () => void;
  errorMessage?: string | null;
}

export default function TransactionNotification({
  isVisible,
  status,
  sellAmount,
  sellToken,
  receiveAmount,
  receiveToken,
  transactionHash,
  onClose,
  errorMessage,
}: TransactionNotificationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`relative rounded-xl p-5 ${
              status === "loading"
                ? "bg-gray-900 border-2 border-gray-700"
                : status === "success"
                  ? "bg-gray-900 border-2 border-green-500"
                  : "bg-gray-900 border-2 border-red-500"
            }`}
          >
            {/* Close button */}
            {status !== "loading" && (
              <button
                onClick={onClose}
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
            {status === "loading" && (
              <div className="text-center">
                <div className="inline-block w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <h3 className="text-lg font-bold text-white">
                  Transaction Loading...
                </h3>
              </div>
            )}

            {/* Error State */}
            {status === "error" && (
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
                    Token swap failed!
                  </h3>
                </div>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed whitespace-pre-wrap">
                  {errorMessage || "An unknown error occurred during the swap"}
                </p>
                <button className="w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors">
                  Try again
                </button>
              </div>
            )}

            {/* Success State */}
            {status === "success" && (
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
                    Token swapped successfully!
                  </h3>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
                  <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-1">
                    You Sent
                  </p>
                  <p className="text-white text-sm font-semibold mb-3">
                    {sellAmount ? parseFloat(sellAmount).toLocaleString('en-US', { maximumFractionDigits: 8 }) : "0"} {sellToken}
                  </p>
                  <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-1">
                    You Received
                  </p>
                  <p className="text-white text-sm font-semibold">
                    {receiveAmount ? parseFloat(receiveAmount).toLocaleString('en-US', { maximumFractionDigits: 8 }) : "0"} {receiveToken}
                  </p>
                </div>
                <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
                  <Image
                    src="/assets/LexaLogo2.svg"
                    alt="LEXA"
                    width={16}
                    height={16}
                    className="opacity-70"
                  />
                  <span>Via LexaSwap</span>
                </div>
                <a
                  href={`https://bscscan.com/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full max-w-50 px-5 py-2.5 bg-white text-black rounded-full font-semibold text-sm hover:bg-gray-200 transition-colors text-center"
                >
                  View transaction
                </a>
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
