// components/swap/SwapSettings.tsx
import { motion, AnimatePresence } from "framer-motion";
import { SLIPPAGE_OPTIONS } from "@/constants/tokens";

interface SwapSettingsProps {
  isOpen: boolean;
  slippage: string;
  customSlippage: string;
  onClose: () => void;
  onSlippageSelect: (value: string) => void;
  onCustomSlippageChange: (value: string) => void;
}

export default function SwapSettings({
  isOpen,
  slippage,
  customSlippage,
  onClose,
  onSlippageSelect,
  onCustomSlippageChange,
}: SwapSettingsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-start justify-center z-50 pt-20 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-gray-900 rounded-2xl p-4 sm:p-6 w-full max-w-md border border-gray-700"
            >
              <h3 className="text-xl font-bold text-white mb-6">
                Swap Settings
              </h3>

              <div className="mb-6">
                <label className="text-gray-400 text-sm font-semibold mb-3 block">
                  Slippage Tolerance
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SLIPPAGE_OPTIONS.map((value) => (
                    <button
                      key={value}
                      onClick={() => onSlippageSelect(value)}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        slippage === value
                          ? "bg-yellow-500 text-black"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                  <button
                    onClick={() => onSlippageSelect("custom")}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      slippage === "custom"
                        ? "bg-yellow-500 text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    Custom
                  </button>
                  <input
                    type="text"
                    value={customSlippage}
                    onChange={(e) => onCustomSlippageChange(e.target.value)}
                    placeholder="0.0"
                    className="w-20 px-3 py-2 bg-gray-800 text-white rounded-lg outline-none text-sm"
                  />
                </div>
                {slippage === "custom" && customSlippage && (
                  <p className="text-xs text-gray-400 mt-2">
                    Custom slippage: {customSlippage}%
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
