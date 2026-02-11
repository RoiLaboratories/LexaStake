"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";

// BNB Smart Chain configuration
const BNB_CHAIN_CONFIG = {
  chainId: 56,
  chainName: "BNB Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: ["https://bsc-dataseed1.binance.org:443"],
  blockExplorerUrls: ["https://bscscan.com"],
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7bb8ff",
        },
        // Force Privy to use BNB Chain as the default network
        defaultChain: {
          id: BNB_CHAIN_CONFIG.chainId,
          name: BNB_CHAIN_CONFIG.chainName,
          nativeCurrency: BNB_CHAIN_CONFIG.nativeCurrency,
          rpcUrls: {
            default: { http: BNB_CHAIN_CONFIG.rpcUrls },
            public: { http: BNB_CHAIN_CONFIG.rpcUrls },
          },
        } as any,
        supportedChains: [
          {
            id: BNB_CHAIN_CONFIG.chainId,
            name: BNB_CHAIN_CONFIG.chainName,
            nativeCurrency: BNB_CHAIN_CONFIG.nativeCurrency,
            rpcUrls: {
              default: { http: BNB_CHAIN_CONFIG.rpcUrls },
              public: { http: BNB_CHAIN_CONFIG.rpcUrls },
            },
          } as any,
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
