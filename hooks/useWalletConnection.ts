import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

// BNB Chain mainnet configuration
const BNB_CHAIN_ID = 56;
const BNB_CHAIN_HEX = "0x38";
const BNB_CHAIN_NAME = "BNB Smart Chain";
const BNB_CHAIN_RPC_URL = "https://bsc-dataseed1.binance.org:443";
const BNB_CHAIN_BLOCK_EXPLORER = "https://bscscan.com";
const BNB_CHAIN_CURRENCY_NAME = "BNB";
const BNB_CHAIN_CURRENCY_SYMBOL = "BNB";
const BNB_CHAIN_CURRENCY_DECIMALS = 18;

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

  /**
   * Requests the user's wallet to switch to BNB Chain mainnet
   */
  const switchToBNBChain = useCallback(async () => {
    try {
      console.log("🔄 Attempting to switch to BNB Chain (chainId: 56, hex: 0x38)...");
      console.log(`📱 Available wallets: ${wallets.map(w => w.walletClientType).join(", ")}`);

      // Get the connected wallet (use the first connected wallet)
      const connectedWallet = wallets[0];
      if (!connectedWallet) {
        throw new Error("No wallet connected");
      }

      console.log(`📱 Connected wallet type: ${connectedWallet.walletClientType}`);

      // Get the provider from the connected wallet
      const provider = await connectedWallet.getEthereumProvider();
      
      if (!provider) {
        throw new Error("Could not get Ethereum provider from wallet");
      }

      // First, check current chain
      let currentChainId: string;
      try {
        currentChainId = await provider.request({
          method: "eth_chainId",
        }) as string;
        console.log(`📊 Current chain before switch: ${currentChainId}`);
      } catch (e) {
        console.error("Failed to get current chain:", e);
        throw new Error("Could not determine current chain");
      }

      // If already on BNB Chain, no need to switch
      if (currentChainId === BNB_CHAIN_HEX) {
        console.log("✓ Already on BNB Chain");
        return;
      }

      console.log(`⚠️ Not on BNB Chain (currently on ${currentChainId}), attempting switch...`);
      
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BNB_CHAIN_HEX }],
        });
        
        console.log("✓ Switch request sent, waiting for confirmation...");
        
        // Wait a bit for the chain to switch
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the switch was successful
        const newChainId = await provider.request({
          method: "eth_chainId",
        }) as string;
        
        console.log(`📊 Chain after switch attempt: ${newChainId}`);
        
        if (newChainId === BNB_CHAIN_HEX) {
          console.log("✓ Successfully switched to BNB Chain (verified)");
          return;
        } else {
          throw new Error(`Switch failed - still on chain ${newChainId}`);
        }
      } catch (switchError: unknown) {
        // This error code indicates that the chain has not been added to MetaMask
        const error = switchError as { code?: number; message?: string };
        
        console.log(`❌ Switch error: code=${error.code}, message=${error.message}`);
        
        if (error.code === 4902 || error.message?.includes("Unrecognized chain ID")) {
          console.log("⚠️ BNB Chain not found in wallet, adding it...");
          
          // Chain not added, so let's add it
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: BNB_CHAIN_HEX,
                  chainName: BNB_CHAIN_NAME,
                  nativeCurrency: {
                    name: BNB_CHAIN_CURRENCY_NAME,
                    symbol: BNB_CHAIN_CURRENCY_SYMBOL,
                    decimals: BNB_CHAIN_CURRENCY_DECIMALS,
                  },
                  rpcUrls: [BNB_CHAIN_RPC_URL],
                  blockExplorerUrls: [BNB_CHAIN_BLOCK_EXPLORER],
                },
              ],
            });
            
            console.log("✓ BNB Chain added to wallet");

            // Wait for add to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // After adding, now switch to it
            console.log("🔄 Now switching to the added BNB Chain...");
            await provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: BNB_CHAIN_HEX }],
            });

            // Wait for switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify the switch was successful after adding
            const verifyChainId = await provider.request({
              method: "eth_chainId",
            }) as string;
            
            console.log(`📊 Chain after adding and switching: ${verifyChainId}`);
            
            if (verifyChainId === BNB_CHAIN_HEX) {
              console.log("✓ Successfully switched to BNB Chain after adding (verified)");
              return;
            } else {
              throw new Error(`Failed to switch after adding - on chain ${verifyChainId}`);
            }
          } catch (addError) {
            throw new Error(`Failed to add BNB Chain: ${addError instanceof Error ? addError.message : String(addError)}`);
          }
        } else if (error.code === 4001) {
          // User rejected
          throw new Error("User rejected the chain switch request");
        } else {
          // Some other error
          throw new Error(`Failed to switch chain: ${error.message || String(switchError)}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Failed to switch to BNB Chain:", errorMessage);
      throw err; // Re-throw so caller knows it failed
    }
  }, [wallets]);

  const connectWallet = useCallback(
    async (walletType?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("🔐 [WALLET] Initiating wallet connection...");
        console.log(`🔐 [WALLET] Privy App ID: ${process.env.NEXT_PUBLIC_PRIVY_APP_ID?.substring(0, 16)}...`);

        // IMPORTANT: Switch to BNB Chain BEFORE login so wallet is on correct network
        console.log("🔄 [WALLET] Pre-authentication: Switching to BNB Chain before signing...");
        try {
          await switchToBNBChain();
          console.log("✓ [WALLET] Successfully switched to BNB Chain before authentication");
        } catch (switchError) {
          console.warn("⚠️ [WALLET] Could not switch chain before login:", switchError);
          // Continue anyway - we'll try again after login
        }

        if (walletType) {
          const methodMap: Record<string, "line" | "wallet" | "email" | "farcaster" | "passkey" | "telegram" | "sms" | "google" | "twitter" | "discord" | "github" | "linkedin" | "spotify" | "instagram" | "tiktok" | "twitch" | "apple"> = {
            metamask: "wallet",
            coinbase: "wallet",
            walletconnect: "wallet",
            embedded: "email",
          };
          const method = methodMap[walletType.toLowerCase()] || "wallet";
          console.log(`📱 [WALLET] Initiating login with method: ${method}`);
          await login({
            loginMethods: [method],
          });
        } else {
          console.log("📱 [WALLET] Initiating login with default methods");
          await login();
        }
        
        console.log("✓ [WALLET] Authentication successful");

        // After successful login, verify we're still on BNB Chain
        console.log("🔄 [WALLET] Post-authentication: Verifying BNB Chain network...");
        await switchToBNBChain();
        console.log("✓ [WALLET] Network verification complete");

      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to connect wallet";
        
        if (errorMessage.includes("user") || errorMessage.includes("rejected")) {
          setError("Connection cancelled by user");
          console.error("[WALLET] User cancelled connection");
        } else {
          setError(errorMessage);
          console.error("[WALLET] Wallet connection error:", err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [login, switchToBNBChain]
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
    switchToBNBChain,
  };
};
