import { ethers } from "ethers";
import { TOKENS } from "@/constants/tokens";

// BSC Mainnet RPC endpoints
const BSC_RPC_URLS = [
  "https://bsc-dataseed1.binance.org:443",
  "https://bsc-dataseed2.binance.org:443",
  "https://bsc-dataseed3.binance.org:443",
];

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

  constructor() {
    // Initialize provider with BSC mainnet
    this.provider = new ethers.JsonRpcProvider(BSC_RPC_URLS[0]);
  }

  /**
   * Fetch token balance for a wallet address
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
  ): Promise<string> {
    try {
      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(BSC_RPC_URLS[0]);
      }

      // Validate addresses
      const validWallet = ethers.getAddress(walletAddress);
      const validToken = ethers.getAddress(tokenAddress);

      // Create contract instance
      const contract = new ethers.Contract(
        validToken,
        ERC20_ABI,
        this.provider,
      );

      // Fetch balance and decimals
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(validWallet),
        contract.decimals(),
      ]);

      // Convert to human-readable format
      const formattedBalance = ethers.formatUnits(balance, decimals);
      return formattedBalance;
    } catch (error) {
      console.error(
        `Error fetching balance for ${tokenAddress} at ${walletAddress}:`,
        error,
      );
      throw error;
    }
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
    try {
      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(BSC_RPC_URLS[0]);
      }

      const validWallet = ethers.getAddress(walletAddress);

      // Fetch BNB balance (native currency)
      const bnbBalanceWei = await this.provider.getBalance(validWallet);
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
      console.error("Error fetching LEXA and BNB balances:", error);
      throw error;
    }
  }
}

export const blockchainService = new BlockchainService();
