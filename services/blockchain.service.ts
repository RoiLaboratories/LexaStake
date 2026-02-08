import { ethers } from "ethers";
import { TOKENS } from "@/constants/tokens";

// Fallback RPC endpoints for balance fetching (no Alchemy by default)
const BSC_RPC_URLS = [
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
  "https://bsc.publicnode.com",
  "https://rpc.ankr.com/bsc",
  "https://bsc.meowrpc.com",
  "https://endpoints.omnirpc.io/bsc",
];

// Alchemy endpoint as final fallback for balance fetching
const getAlchemyUrl = (): string | null => {
  if (process.env.ALCHEMY_API_KEY) {
    return `https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  }
  return null;
};

// Create BSC network object once to avoid repeated initialization
const BSC_NETWORK = ethers.Network.from({
  chainId: 56,
  name: "binance",
});

// ERC20 ABI (minimal - just balanceOf function)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private currentRpcIndex: number = 0;

  constructor() {
    this.initializeProvider();
  }

  /** RPC call timeout (public RPCs can be slow) */
  private static RPC_TIMEOUT_MS = 12000;

  /**
   * Wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number = BlockchainService.RPC_TIMEOUT_MS): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
      ),
    ]);
  }

  private initializeProvider() {
    if (this.currentRpcIndex < BSC_RPC_URLS.length) {
      this.provider = new ethers.JsonRpcProvider(
        BSC_RPC_URLS[this.currentRpcIndex],
        BSC_NETWORK,
        { staticNetwork: true }
      ) as ethers.JsonRpcProvider;
    }
  }

  private async switchToNextRpc(): Promise<void> {
    this.currentRpcIndex++;
    if (this.currentRpcIndex >= BSC_RPC_URLS.length) {
      this.currentRpcIndex = 0;
    }
    this.provider = new ethers.JsonRpcProvider(
      BSC_RPC_URLS[this.currentRpcIndex],
      BSC_NETWORK,
      { staticNetwork: true }
    ) as ethers.JsonRpcProvider;
  }

  /** Create a provider that skips network detection (avoids "failed to detect network" timeouts) */
  private createStaticProvider(url: string): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(url, BSC_NETWORK, {
      staticNetwork: true,
    }) as ethers.JsonRpcProvider;
  }

  /**
   * Fetch token balance for a wallet address
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
  ): Promise<string> {
    let lastError: Error | null = null;

    // When Alchemy is configured, try it first (fast and reliable)
    const alchemyUrl = getAlchemyUrl();
    if (alchemyUrl) {
      try {
        const alchemyProvider = this.createStaticProvider(alchemyUrl);
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }

        if (tokenAddress.toLowerCase() === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c") {
          const balance = await this.withTimeout(alchemyProvider.getBalance(validWallet));
          return ethers.formatEther(balance);
        }

        let validToken: string;
        try {
          validToken = ethers.getAddress(tokenAddress);
        } catch {
          validToken = tokenAddress.toLowerCase();
        }

        const contract = new ethers.Contract(validToken, ERC20_ABI, alchemyProvider);
        const [balance, decimals] = await this.withTimeout(
          Promise.all([contract.balanceOf(validWallet), contract.decimals()])
        );
        return ethers.formatUnits(balance, decimals);
      } catch (alchemyError) {
        console.warn("Alchemy balance fetch failed, trying public RPCs:", alchemyError);
      }
    }

    // Try public RPC endpoints
    for (let attempt = 0; attempt < BSC_RPC_URLS.length; attempt++) {
      try {
        if (!this.provider) {
          this.initializeProvider();
        }
        
        const provider = this.provider;
        if (!provider) {
          throw new Error("Failed to initialize RPC provider");
        }

        // Validate wallet address with fallback to lowercase
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }

        // Check if it's BNB (native currency) by comparing with WBNB address
        if (
          tokenAddress.toLowerCase() ===
          "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
        ) {
          // Fetch native BNB balance with timeout
          const balance = await this.withTimeout(provider.getBalance(validWallet));
          return ethers.formatEther(balance);
        }

        // For ERC20 tokens, validate and use contract with fallback to lowercase
        let validToken: string;
        try {
          validToken = ethers.getAddress(tokenAddress);
        } catch {
          validToken = tokenAddress.toLowerCase();
        }

        // Create contract instance
        const contract = new ethers.Contract(
          validToken,
          ERC20_ABI,
          provider,
        );

        // Fetch balance and decimals with timeout
        const [balance, decimals] = await this.withTimeout(
          Promise.all([
            contract.balanceOf(validWallet),
            contract.decimals(),
          ])
        );

        // Convert to human-readable format
        const formattedBalance = ethers.formatUnits(balance, decimals);
        return formattedBalance;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(
          `RPC attempt ${attempt + 1} (${BSC_RPC_URLS[this.currentRpcIndex]}) failed: ${errorMessage}`,
        );

        // Try next RPC endpoint
        if (attempt < BSC_RPC_URLS.length - 1) {
          await this.switchToNextRpc();
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    // Try Alchemy again when configured (fallback after public RPCs failed)
    const alchemyUrlFallback = getAlchemyUrl();
    if (alchemyUrlFallback) {
      try {
        const alchemyProvider = this.createStaticProvider(alchemyUrlFallback);
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }

        if (tokenAddress.toLowerCase() === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c") {
          const balance = await this.withTimeout(alchemyProvider.getBalance(validWallet));
          return ethers.formatEther(balance);
        }

        let validToken: string;
        try {
          validToken = ethers.getAddress(tokenAddress);
        } catch {
          validToken = tokenAddress.toLowerCase();
        }

        const contract = new ethers.Contract(validToken, ERC20_ABI, alchemyProvider);
        const [balance, decimals] = await this.withTimeout(
          Promise.all([contract.balanceOf(validWallet), contract.decimals()])
        );
        return ethers.formatUnits(balance, decimals);
      } catch (alchemyError) {
        console.error("Alchemy endpoint also failed:", alchemyError);
      }
    }

    // All RPCs failed
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(
      `All RPC endpoints failed fetching balance for ${tokenAddress} at ${walletAddress}: ${errorMessage}`,
    );
    
    // Mock fallback for development/testing - return 0 balance
    console.warn("All RPC endpoints unavailable. Returning mock balance (0) for development.");
    return "0";
  }

  /**
   * Fetch multiple token balances at once
   */
  async getMultipleTokenBalances(
    walletAddress: string,
    tokenAddresses: string[],
  ): Promise<Record<string, string>> {
    try {
      const balances = await Promise.all(
        tokenAddresses.map((addr) => this.getTokenBalance(walletAddress, addr)),
      );

      const result: Record<string, string> = {};
      tokenAddresses.forEach((addr, index) => {
        result[addr.toLowerCase()] = balances[index];
      });

      return result;
    } catch (error) {
      console.error("Error fetching multiple balances:", error);
      throw error;
    }
  }

  /**
   * Fetch BNB and LEXA balances for a wallet
   */
  async getLexaAndBNBBalances(
    walletAddress: string,
  ): Promise<{ lexa: string; bnb: string }> {
    // When Alchemy is configured, try it first (avoids public RPC timeouts)
    const alchemyUrl = getAlchemyUrl();
    if (alchemyUrl) {
      try {
        const alchemyProvider = this.createStaticProvider(alchemyUrl);
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }
        const bnbBalanceWei = await this.withTimeout(alchemyProvider.getBalance(validWallet));
        const bnbBalance = ethers.formatEther(bnbBalanceWei);
        const lexaBalance = await this.getTokenBalance(walletAddress, TOKENS.LEXA.address);
        return { lexa: lexaBalance, bnb: bnbBalance };
      } catch (alchemyError) {
        console.warn("Alchemy LEXA/BNB fetch failed, trying public RPCs:", alchemyError);
      }
    }

    let lastError: Error | null = null;
    const maxAttempts = BSC_RPC_URLS.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (!this.provider) {
          this.initializeProvider();
        }
        
        const provider = this.provider;
        if (!provider) {
          throw new Error("Failed to initialize RPC provider");
        }

        // Validate wallet address (Privy may return non-checksummed addresses)
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }

        // Fetch BNB balance (native currency) with timeout
        const bnbBalanceWei = await this.withTimeout(provider.getBalance(validWallet));
        const bnbBalance = ethers.formatEther(bnbBalanceWei);

        // Fetch LEXA balance (token contract)
        const lexaBalance = await this.getTokenBalance(
          walletAddress,
          TOKENS.LEXA.address,
        );

        return {
          lexa: lexaBalance,
          bnb: bnbBalance,
        };
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(
          `RPC attempt ${attempt + 1} (${BSC_RPC_URLS[this.currentRpcIndex]}) failed: ${errorMessage}`,
        );

        // Try next RPC endpoint
        if (attempt < maxAttempts - 1) {
          await this.switchToNextRpc();
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    // Try Alchemy when configured (fallback)
    const alchemyUrlFallback = getAlchemyUrl();
    if (alchemyUrlFallback) {
      try {
        const alchemyProvider = this.createStaticProvider(alchemyUrlFallback);
        let validWallet: string;
        try {
          validWallet = ethers.getAddress(walletAddress);
        } catch {
          validWallet = walletAddress.toLowerCase();
        }
        const bnbBalanceWei = await this.withTimeout(alchemyProvider.getBalance(validWallet));
        const bnbBalance = ethers.formatEther(bnbBalanceWei);
        const lexaBalance = await this.getTokenBalance(walletAddress, TOKENS.LEXA.address);
        return { lexa: lexaBalance, bnb: bnbBalance };
      } catch (alchemyError) {
        console.error("Alchemy endpoint also failed:", alchemyError);
      }
    }

    // All RPCs failed
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    console.error("All RPC endpoints failed fetching LEXA and BNB balances:", errorMessage);
    
    // Mock fallback for development/testing - return 0 balances
    console.warn("All RPC endpoints unavailable. Returning mock balances (0) for development.");
    return {
      lexa: "0",
      bnb: "0",
    };
  }
}

export const blockchainService = new BlockchainService();
