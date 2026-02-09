import { Wallet } from "lucide-react";
import { Token } from "@/types/swap.types";
import TokenSelector from "./TokenSelector";

interface SwapInputProps {
  label: "Sell" | "Receive";
  token: Token;
  amount: string;
  balance?: string;
  tokenPrice?: number;
  onAmountChange: (value: string) => void;
  onTokenClick?: () => void;
  onMaxClick?: () => void;
  onPercentageClick?: (percentage: number) => void;
  disabled?: boolean;
  showBalance?: boolean;
  isLoading?: boolean;
}

export default function SwapInput({
  label,
  token,
  amount,
  balance,
  tokenPrice,
  onAmountChange,
  onTokenClick,
  onMaxClick,
  onPercentageClick,
  disabled = false,
  showBalance = true,
  isLoading = false,
}: SwapInputProps) {
  const borderRadius = label === "Sell" ? "rounded-t-2xl" : "rounded-b-2xl";
  
  // Calculate USD value
  const calculateUsdValue = (): string => {
    if (!amount || !tokenPrice || tokenPrice === 0) {
      return "$0.00";
    }
    
    const usdValue = parseFloat(amount) * tokenPrice;
    return "$" + usdValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  return (
    <div className={`bg-[#151617] ${borderRadius} p-4 sm:p-5`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <span className="text-gray-400 font-semibold text-sm">{label}</span>

        {showBalance && (
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-wrap">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Wallet className="w-4 h-4 opacity-70" />
              <span>
                {balance ? parseFloat(balance).toLocaleString() : 0}{" "}
                {token.symbol}
              </span>
            </div>

            {label === "Sell" && onPercentageClick && (
              <>
                <button
                  onClick={() => onPercentageClick(0.5)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  50%
                </button>
                <button
                  onClick={onMaxClick}
                  disabled={disabled}
                  className="px-2 py-1 border border-yellow-500 text-yellow-500 rounded text-xs font-bold hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Max
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Token and Amount */}
      <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
        <TokenSelector
          token={token}
          onClick={onTokenClick}
          disabled={disabled}
        />

        <div className="flex flex-col items-end w-full sm:w-auto">
          <input
            type="text"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            disabled={disabled || isLoading}
            className="bg-transparent text-2xl sm:text-4xl text-white font-bold outline-none text-right w-full sm:w-48 placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-gray-500 text-sm mt-1">
            {isLoading ? "Loading..." : calculateUsdValue()}
          </span>
        </div>
      </div>
    </div>
  );
}
