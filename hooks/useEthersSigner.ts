"use client";

import { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";

interface Eip1193Request {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

interface Eip1193Provider {
  request(args: Eip1193Request): Promise<unknown>;
}

function walletClientToProvider(walletClient: WalletClient): BrowserProvider {
  const chain = walletClient.chain;
  const network = chain
    ? {
        chainId: chain.id,
        name: chain.name,
      }
    : undefined;

  return new BrowserProvider(
    walletClient.transport as Eip1193Provider,
    network,
  );
}

export function useEthersProvider() {
  const { data: walletClient } = useWalletClient();

  return useCallback(() => {
    if (walletClient) {
      return walletClientToProvider(walletClient);
    }

    if (typeof window !== "undefined" && window.ethereum) {
      return new BrowserProvider(window.ethereum);
    }

    throw new Error("Wallet provider not available");
  }, [walletClient]);
}

export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();
  const getProvider = useEthersProvider();

  return useCallback(async () => {
    const provider = getProvider();
    return provider.getSigner(walletClient?.account.address);
  }, [getProvider, walletClient?.account.address]);
}
