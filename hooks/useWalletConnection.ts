"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useState } from "react";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";

const BNB_CHAIN_HEX = "0x38";
const BNB_CHAIN_NAME = "BNB Smart Chain";
const BNB_CHAIN_RPC_URL = "https://bsc-dataseed1.binance.org:443";
const BNB_CHAIN_BLOCK_EXPLORER = "https://bscscan.com";

export const useWalletConnection = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWalletAddress = useCallback(() => address ?? null, [address]);

  const getDisplayAddress = useCallback(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const addBnbChainWithInjectedProvider = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BNB_CHAIN_HEX,
          chainName: BNB_CHAIN_NAME,
          nativeCurrency: {
            name: "BNB",
            symbol: "BNB",
            decimals: 18,
          },
          rpcUrls: [BNB_CHAIN_RPC_URL],
          blockExplorerUrls: [BNB_CHAIN_BLOCK_EXPLORER],
        },
      ],
    });
  }, []);

  const switchToBNBChain = useCallback(async () => {
    if (chainId === bsc.id) {
      return;
    }

    try {
      await switchChainAsync({ chainId: bsc.id });
    } catch (switchError) {
      const message =
        switchError instanceof Error ? switchError.message : String(switchError);

      if (
        message.includes("Unrecognized chain") ||
        message.includes("4902") ||
        message.includes("not been added")
      ) {
        await addBnbChainWithInjectedProvider();
        await switchChainAsync({ chainId: bsc.id });
        return;
      }

      throw switchError;
    }
  }, [addBnbChainWithInjectedProvider, chainId, switchChainAsync]);

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      openConnectModal?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [openConnectModal]);

  const disconnectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await disconnectAsync();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to disconnect wallet";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [disconnectAsync]);

  return {
    authenticated: isConnected,
    user: address ? { wallet: { address } } : null,
    wallets: [],
    isLoading,
    error,
    getWalletAddress,
    getDisplayAddress,
    getAccountEmail: () => null,
    getAccountPhone: () => null,
    connectWallet,
    disconnectWallet,
    switchToBNBChain,
  };
};
