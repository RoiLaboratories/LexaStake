import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

export const useWalletConnection = () => {
  const { user, authenticated, logout, login } = usePrivy();
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWalletAddress = useCallback(() => {
    if (!user) return null;

    // Try to get wallet address
    if (user.wallet?.address) {
      return user.wallet.address;
    }

    // Try to get embedded wallet address
    if (user.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc) => "type" in acc && acc.type === "wallet"
      );
      if (walletAccount && "address" in walletAccount) {
        return (walletAccount as { address: string }).address;
      }
    }

    return null;
  }, [user]);

  const getDisplayAddress = useCallback(() => {
    const address = getWalletAddress();
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [getWalletAddress]);

  const connectWallet = useCallback(
    async (walletType?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        if (walletType) {
          const methodMap: Record<string, "line" | "wallet" | "email" | "farcaster" | "passkey" | "telegram" | "sms" | "google" | "twitter" | "discord" | "github" | "linkedin" | "spotify" | "instagram" | "tiktok" | "twitch" | "apple"> = {
            metamask: "wallet",
            coinbase: "wallet",
            walletconnect: "wallet",
            embedded: "email",
          };
          const method = methodMap[walletType.toLowerCase()] || "wallet";
          await login({
            loginMethods: [method],
          });
        } else {
          await login();
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to connect wallet";
        setError(errorMessage);
        console.error("Wallet connection error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [login]
  );

  const disconnectWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      await logout();
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to disconnect wallet";
      setError(errorMessage);
      console.error("Wallet disconnection error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const getAccountEmail = useCallback(() => {
    if (!user) return null;
    return user.email?.address || null;
  }, [user]);

  const getAccountPhone = useCallback(() => {
    if (!user) return null;
    return user.phone?.number || null;
  }, [user]);

  return {
    authenticated,
    user,
    wallets,
    isLoading,
    error,
    getWalletAddress,
    getDisplayAddress,
    getAccountEmail,
    getAccountPhone,
    connectWallet,
    disconnectWallet,
  };
};
