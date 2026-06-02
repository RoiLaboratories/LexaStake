"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Wallet } from "lucide-react";

interface WalletConnectButtonProps {
  compact?: boolean;
}

export default function WalletConnectButton({
  compact = false,
}: WalletConnectButtonProps) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            className="flex items-center gap-2"
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!connected ? (
              <motion.button
                type="button"
                onClick={openConnectModal}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 font-bold text-black shadow-lg shadow-yellow-500/15 transition-all hover:bg-yellow-400 ${
                  compact
                    ? "px-3 py-2 text-xs sm:px-4 sm:text-sm"
                    : "px-4 py-2.5 text-sm sm:px-6 sm:py-3"
                }`}
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Connect</span>
              </motion.button>
            ) : chain.unsupported ? (
              <motion.button
                type="button"
                onClick={openChainModal}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 font-bold text-white transition-all hover:bg-red-400 ${
                  compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                Wrong network
              </motion.button>
            ) : (
              <>
                <motion.button
                  type="button"
                  onClick={openChainModal}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="hidden items-center gap-2 rounded-xl border border-yellow-500/40 bg-black/50 px-3 py-2.5 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/10 md:inline-flex"
                >
                  {chain.hasIcon && chain.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={chain.iconUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-yellow-500"
                      aria-hidden="true"
                    />
                  )}
                  {chain.name ?? "BNB Chain"}
                  <ChevronDown className="h-4 w-4" />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={openAccountModal}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-yellow-500 font-bold text-black shadow-lg shadow-yellow-500/15 transition-all hover:bg-yellow-400 ${
                    compact
                      ? "max-w-[8.5rem] px-3 py-2 text-xs sm:max-w-none sm:px-4 sm:text-sm"
                      : "max-w-[9.5rem] px-4 py-2.5 text-sm sm:max-w-none sm:px-6 sm:py-3"
                  }`}
                >
                  <span className="min-w-0 truncate">{account.displayName}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </motion.button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
