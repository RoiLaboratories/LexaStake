"use client";

import { useAccount } from "wagmi";

export function useConnectedWallet() {
  const { address, isConnected } = useAccount();
  const walletAddress = address ?? null;
  const authenticated = isConnected && Boolean(walletAddress);
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  return {
    authenticated,
    walletAddress,
    displayAddress,
  };
}
