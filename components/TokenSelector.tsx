"use client";
import { Token } from "@/types/swap.types";
import TokenIcon from "./TokenIcon";

interface TokenSelectorProps {
  token: Token;
  onClick?: () => void;
  disabled?: boolean;
}

export default function TokenSelector({
  token,
  onClick,
  disabled = false,
}: TokenSelectorProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <TokenIcon token={token} />
      <span className="text-white font-semibold">{token.symbol}</span>
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}
