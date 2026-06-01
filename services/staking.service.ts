import { ethers } from "ethers";
import { TOKENS } from "@/constants/tokens";

// LexaStaking Contract ABI (essential functions only)
const LEXA_STAKING_ABI = [
  "function stake(uint256 amount,uint8 tier,uint256 durationDays,address referrer)",
  "function claimRewards(uint256 stakeIndex)",
  "function restakeRewards(uint256 stakeIndex)",
  "function getAccumulatedRewards(address user,uint256 stakeIndex) view returns (uint256)",
  "function isStakeMatured(address user,uint256 stakeIndex) view returns (bool)",
  "function unstake(uint256 stakeIndex)",
  "function userStakeCount(address user) view returns (uint256)",
  "function userStakes(address user,uint256 index) view returns (uint256 amount,uint256 lockDurationDays,uint256 startTimestamp,uint8 tier,uint256 totalRewardsEntitled,uint256 totalRewardsClaimed,bool active)",
  "function getTierConfig(uint8 tier) view returns (uint256 minStakeAmount,uint256 roi90days,uint256 roi180days)",
];

// ERC20 ABI (for LEXA token approval)
const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// Staking tier enum
export enum StakingTier {
  BRONZE = 0,
  SILVER = 1,
  GOLD = 2,
}

export interface StakeParams {
  amount: bigint;
  tier: StakingTier;
  durationDays: number;
  referrer?: string;
}

class StakingService {
  // Staking contract address - update this with your deployed contract address
  private readonly STAKING_CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS ||
    "0xE9Fd554aF2428Cdce21A437eCf6AaD3FA7B3Da91";

  private readonly LEXA_TOKEN_ADDRESS = TOKENS.LEXA.address;

  /**
   * Get Alchemy RPC provider for BSC mainnet
   * On server: Uses private ALCHEMY_API_KEY
   * On client: Falls back to public RPC endpoint
   * For client-side read operations, uses /api/staking/rpc endpoint
   */
  private getAlchemyProvider(): ethers.JsonRpcProvider {
    // Try to use private API key (only available on server)
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    
    if (alchemyKey) {
      const alchemyRpcUrl = `https://bsc-mainnet.g.alchemy.com/v2/${alchemyKey}`;
      console.log("📡 Using Alchemy RPC with private API key (server-side)");
      return new ethers.JsonRpcProvider(alchemyRpcUrl);
    }

    // Fallback to public RPC on client-side
    console.log("⚠️ Using public RPC endpoint (client-side - consider using server actions for better performance)");
    return new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc.meowrpc.com"
    );
  }

  /**
   * Get ethers signer from Privy wallet
   * To be called from a component using the usePrivy hook
   * 
   * @example
   * const { user } = usePrivy();
   * if (user?.wallet?.chainId === 56) {
   *   const provider = await user.wallet.getEthersProvider();
   *   const signer = await provider.getSigner();
   *   // Pass signer to stakingService methods
   * }
   */

  /**
   * Check LEXA token allowance
   * @param userAddress User wallet address
   */
  async checkAllowance(userAddress: string): Promise<bigint> {
    try {
      const provider = this.getAlchemyProvider();
      console.log("🔍 Checking LEXA allowance for:", userAddress);
      console.log(`Token Address: ${this.LEXA_TOKEN_ADDRESS}`);

      const lexaContract = new ethers.Contract(
        this.LEXA_TOKEN_ADDRESS,
        ERC20_ABI,
        provider
      );

      try {
        const allowance = await lexaContract.allowance(
          userAddress,
          this.STAKING_CONTRACT_ADDRESS
        );

        console.log("✓ Allowance:", ethers.formatEther(allowance), "LEXA");
        return allowance;
      } catch (allowanceError: any) {
        console.error("❌ Failed to check allowance:", allowanceError);
        
        if (allowanceError.code === 'CALL_EXCEPTION') {
          throw new Error(
            `Failed to call allowance on LEXA token at ${this.LEXA_TOKEN_ADDRESS}. The contract may not be a valid ERC20 token or the address may be incorrect.`
          );
        }
        
        throw allowanceError;
      }
    } catch (error) {
      console.error("❌ Error checking allowance:", error);
      throw error;
    }
  }

  /**
   * Approve LEXA token for staking
   * @param amount Amount to approve in wei
   * @param signer Ethers signer from Privy wallet
   */
  async approveToken(
    amount: bigint,
    signer: ethers.Signer
  ): Promise<{ hash: string; status: boolean }> {
    try {
      if (!signer) {
        throw new Error("Signer not available");
      }

      // Use signer directly for write operations
      const lexaContract = new ethers.Contract(
        this.LEXA_TOKEN_ADDRESS,
        ERC20_ABI,
        signer
      );

      console.log(`📤 Approving ${ethers.formatEther(amount)} LEXA for staking contract...`);
      console.log(`Token Address: ${this.LEXA_TOKEN_ADDRESS}`);
      console.log(`Spender (Staking Contract): ${this.STAKING_CONTRACT_ADDRESS}`);

      // Verify we're on the correct network before approval
      try {
        const network = await signer.provider?.getNetwork();
        console.log(`📊 Current network: ${network?.name} (chainId: ${network?.chainId})`);
        if (network?.chainId !== BigInt(56)) {
          throw new Error(
            `You are on the wrong network (${network?.name}). Please switch to BNB Chain (chainId 56) in your wallet.`
          );
        }
      } catch (networkError: any) {
        if (networkError.message.includes('wrong network')) {
          throw networkError;
        }
        console.warn("⚠️ Could not verify network:", networkError);
      }

      try {
        const tx = await lexaContract.approve(
          this.STAKING_CONTRACT_ADDRESS,
          amount
        );

        console.log("✓ Approval transaction sent:", tx.hash);

        console.log("⏳ Waiting for approval confirmation...");
        const receipt = await tx.wait();

        console.log("✓ Approval confirmed:", receipt);

        return {
          hash: tx.hash,
          status: receipt?.status === 1,
        };
      } catch (approveError: any) {
        console.error("❌ Approve call failed:", approveError);
        
        // Provide helpful error message
        if (approveError.code === 'CALL_EXCEPTION') {
          // Mobile wallet network switching issue
          const errorMsg = approveError.message || '';
          if (errorMsg.includes('revert') || errorMsg.includes('estimateGas')) {
            throw new Error(
              'Network Error: Your wallet may not be properly connected to BNB Chain. ' +
              'Please manually switch to BNB Chain in your Bitget app settings and try again.'
            );
          }
          
          throw new Error(
            `Failed to call approve on LEXA token. This may indicate the token address (${this.LEXA_TOKEN_ADDRESS}) is incorrect or the contract is not a valid ERC20 token. Error details: ${approveError.message}`
          );
        }
        
        throw approveError;
      }
    } catch (error) {
      console.error("Error approving token:", error);
      throw error;
    }
  }

  /**
   * Stake LEXA tokens
   * @param params Staking parameters (amount, tier, duration)
   * @param signer Ethers signer from Privy wallet
   */
  async stake(
    params: StakeParams,
    signer: ethers.Signer
  ): Promise<{ hash: string; status: boolean }> {
    try {
      if (!signer) {
        throw new Error("Signer not available");
      }

      console.log("📝 Creating staking contract instance...");
      
      // Use signer directly for write operations
      // The signer will handle both signing and sending transactions
      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        signer
      );

      // Check and approve if necessary
      console.log("🔍 Getting user address from signer...");
      let userAddress: string;
      try {
        userAddress = await signer.getAddress();
        console.log("✓ User address:", userAddress);
      } catch (addressError) {
        console.error("❌ Failed to get user address:", addressError);
        throw new Error(`Could not get wallet address: ${addressError instanceof Error ? addressError.message : String(addressError)}`);
      }

      console.log("⏳ Checking token allowance...");
      const currentAllowance = await this.checkAllowance(userAddress);
      console.log("Current allowance:", ethers.formatEther(currentAllowance), "LEXA");

      if (currentAllowance < params.amount) {
        console.log("📤 Allowance insufficient, requesting approval...");
        await this.approveToken(params.amount, signer);
        console.log("✓ Approval completed");
      } else {
        console.log("✓ Sufficient allowance already granted");
      }

      console.log(
        `💰 Staking ${ethers.formatEther(params.amount)} LEXA for ${params.durationDays} days at tier ${params.tier}...`
      );

      // Validate and use referrer if provided
      let referrer = ethers.ZeroAddress;
      if (params.referrer) {
        try {
          // Verify it's a valid Ethereum address
          referrer = ethers.getAddress(params.referrer);
          console.log(`👥 Referrer address: ${referrer}`);
        } catch (addressError) {
          console.warn(`⚠️ Invalid referrer address: ${params.referrer}, using zero address`);
          referrer = ethers.ZeroAddress;
        }
      }

      console.log("⏳ Sending stake transaction to blockchain...");
      const tx = await stakingContract.stake(
        params.amount,
        params.tier,
        params.durationDays,
        referrer
      );

      console.log("✓ Stake transaction sent:", tx.hash);

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      console.log("✓ Stake confirmed:", receipt);

      return {
        hash: tx.hash,
        status: receipt?.status === 1,
      };
    } catch (error) {
      console.error("❌ Error staking:", error);
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          throw new Error(
            "Network error: Unable to connect to blockchain. Please check your internet connection and try again."
          );
        }
        if (error.message.includes("insufficient")) {
          throw new Error(
            "Insufficient balance or allowance. Please check your LEXA balance and try again."
          );
        }
      }
      
      throw error;
    }
  }

  /**
   * Find all stakes with claimable rewards
   * Useful for debugging stake_index mismatches
   */
  async findStakesWithRewards(
    userAddress: string
  ): Promise<{ stakeIndex: number; rewards: string }[]> {
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_BSC_RPC_URL ||
          "https://bsc.meowrpc.com"
      );

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        provider
      );

      // Get user's stake count
      const stakeCount = Number(await stakingContract.userStakeCount(userAddress));
      console.log(`📊 User has ${stakeCount} total stakes`);

      const stakesWithRewards: { stakeIndex: number; rewards: string }[] = [];

      // Check each stake for rewards
      for (let i = 0; i < stakeCount; i++) {
        try {
          const rewards = await stakingContract.getAccumulatedRewards(
            userAddress,
            i
          );
          const rewardsEther = ethers.formatEther(rewards);
          console.log(`  Stake ${i}: ${rewardsEther} LEXA`);
          
          if (rewards > BigInt(0)) {
            stakesWithRewards.push({
              stakeIndex: i,
              rewards: rewardsEther,
            });
          }
        } catch (err) {
          console.log(`  Stake ${i}: Error checking (may not exist)`);
        }
      }

      console.log(`✅ Found ${stakesWithRewards.length} stake(s) with rewards`);
      return stakesWithRewards;
    } catch (error) {
      console.error("Error finding stakes with rewards:", error);
      throw error;
    }
  }

  /**
   * Claim rewards from a stake
   * @param stakeIndex Index of the stake
   * @param signer Ethers signer from Privy wallet
   * @param userAddress User wallet address (for validation)
   */
  async claimRewards(
    stakeIndex: number,
    signer: ethers.Signer,
    userAddress?: string
  ): Promise<{ hash: string; status: boolean }> {
    try {
      if (!signer) {
        throw new Error("Signer not available");
      }

      // Get the user's address if not provided
      const walletAddr = userAddress || (await signer.getAddress());

      // Check and log accumulated rewards (for informational purposes)
      console.log(`Checking accumulated rewards for stake index ${stakeIndex}...`);
      try {
        const accumulatedRewardsStr = await this.getAccumulatedRewards(walletAddr, stakeIndex);
        const accumulatedRewards = parseFloat(accumulatedRewardsStr);
        console.log(`Accumulated rewards from contract: ${accumulatedRewardsStr} LEXA`);
        
        if (accumulatedRewards <= 0) {
          console.warn(
            `Contract reports 0 claimable rewards. ` +
            `Claiming is only available after the lock duration elapses.`
          );
        }
      } catch (rewardsError) {
        console.warn("Could not fetch claimable rewards:", rewardsError);
      }

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        signer
      );

      const claimableRewardsStr = await this.getAccumulatedRewards(walletAddr, stakeIndex);
      if (parseFloat(claimableRewardsStr) <= 0) {
        throw new Error("Rewards are claimable only after the lock duration elapses");
      }

      console.log(`Attempting to claim rewards for stake index ${stakeIndex}...`);

      const tx = await stakingContract.claimRewards(stakeIndex);

      console.log("Claim rewards transaction sent:", tx.hash);

      const receipt = await tx.wait();

      console.log("Claim confirmed:", receipt);

      return {
        hash: tx.hash,
        status: receipt?.status === 1,
      };
    } catch (error) {
      console.error("Error claiming rewards:", error);
      throw error;
    }
  }

  /**
   * Restake rewards back into the same stake position
   * @param stakeIndex Index of the stake
   * @param signer Ethers signer from Privy wallet
   * @param userAddress User wallet address (for validation)
   */
  async restakeRewards(
    stakeIndex: number,
    signer: ethers.Signer,
    userAddress?: string
  ): Promise<{ hash: string; status: boolean }> {
    try {
      if (!signer) {
        throw new Error("Signer not available");
      }

      // Get the user's address if not provided
      const walletAddr = userAddress || (await signer.getAddress());

      // Check and log accumulated rewards (for informational purposes)
      console.log(`Checking accumulated rewards for stake index ${stakeIndex}...`);
      try {
        const accumulatedRewardsStr = await this.getAccumulatedRewards(walletAddr, stakeIndex);
        const accumulatedRewards = parseFloat(accumulatedRewardsStr);
        console.log(`Accumulated rewards to restake: ${accumulatedRewardsStr} LEXA`);
        
        if (accumulatedRewards <= 0) {
          throw new Error("No rewards available to restake");
        }
      } catch (rewardsError) {
        console.warn("Could not fetch accumulated rewards:", rewardsError);
        throw rewardsError;
      }

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        signer
      );

      console.log(`Attempting to restake rewards for stake index ${stakeIndex}...`);

      const tx = await stakingContract.restakeRewards(stakeIndex);

      console.log("Restake rewards transaction sent:", tx.hash);

      const receipt = await tx.wait();

      console.log("Restake confirmed:", receipt);

      return {
        hash: tx.hash,
        status: receipt?.status === 1,
      };
    } catch (error) {
      console.error("Error restaking rewards:", error);
      throw error;
    }
  }

  /**
   * Get accumulated rewards for a stake
   */
  async getAccumulatedRewards(
    userAddress: string,
    stakeIndex: number
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_BSC_RPC_URL ||
          "https://bsc.meowrpc.com"
      );

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        provider
      );

      const rewards = await stakingContract.getAccumulatedRewards(
        userAddress,
        stakeIndex
      );

      return ethers.formatEther(rewards);
    } catch (error) {
      console.error("Error getting accumulated rewards:", error);
      throw error;
    }
  }

  /**
   * Unstake tokens
   * @param stakeIndex Index of the stake
   * @param signer Ethers signer from Privy wallet
   */
  async unstake(
    stakeIndex: number,
    signer: ethers.Signer
  ): Promise<{ hash: string; status: boolean }> {
    try {
      if (!signer) {
        throw new Error("Signer not available");
      }

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        signer
      );

      console.log(`Unstaking stake index ${stakeIndex}...`);

      const tx = await stakingContract.unstake(stakeIndex);

      console.log("Unstake transaction sent:", tx.hash);

      const receipt = await tx.wait();

      console.log("Unstake confirmed:", receipt);

      return {
        hash: tx.hash,
        status: receipt?.status === 1,
      };
    } catch (error) {
      console.error("Error unstaking:", error);
      throw error;
    }
  }

  /**
   * Get user's stake count
   * @param userAddress User wallet address
   */
  async getUserStakeCount(userAddress: string): Promise<number> {
    try {
      // Validate address format
      if (!userAddress || !userAddress.startsWith("0x") || userAddress.length !== 42) {
        console.warn(`⚠️ Invalid user address format: ${userAddress}, returning 0`);
        return 0;
      }

      const provider = this.getAlchemyProvider();

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        provider
      );

      console.log(`🔍 Getting stake count for ${userAddress}...`);

      let stakeCount;
      try {
        stakeCount = await stakingContract.userStakeCount(userAddress);
      } catch (contractError: any) {
        // If contract call fails, return 0 instead of crashing
        // This handles new users or access control issues
        const errorMsg = contractError?.reason || contractError?.message || String(contractError);
        console.warn(
          `⚠️ Contract call failed for userStakeCount (might be a new user or access control): ${errorMsg}`
        );
        return 0;
      }

      const count = Number(stakeCount);

      console.log("✓ Stake count:", count);
      return count;
    } catch (error) {
      console.error("❌ Error getting user stake count:", error);
      // Return 0 for new users instead of throwing
      return 0;
    }
  }

  /**
   * Get stake details
   * @param userAddress User wallet address
   * @param stakeIndex Index of the stake
   */
  async getStakeDetails(
    userAddress: string,
    stakeIndex: number
  ): Promise<{
    amount: string;
    tier: number;
    lockDurationDays: number;
    startTimestamp: number;
    lockEndTime: number;
    totalRewardsEntitled: string;
    rewardsClaimed: string;
    active: boolean;
  }> {
    try {
      const provider = this.getAlchemyProvider();

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        provider
      );

      console.log(`📋 Getting stake details for index ${stakeIndex}...`);

      const stake = await stakingContract.userStakes(userAddress, stakeIndex);
      const lockDurationDays = Number(stake.lockDurationDays);
      const startTimestamp = Number(stake.startTimestamp);

      return {
        amount: ethers.formatEther(stake.amount),
        tier: Number(stake.tier),
        lockDurationDays,
        startTimestamp,
        lockEndTime: startTimestamp + lockDurationDays * 86400,
        totalRewardsEntitled: ethers.formatEther(stake.totalRewardsEntitled),
        rewardsClaimed: ethers.formatEther(stake.totalRewardsClaimed),
        active: Boolean(stake.active),
      };
    } catch (error) {
      console.error("❌ Error getting stake details:", error);
      throw error;
    }
  }

  /**
   * Get tier configuration from smart contract
   * @param tierIndex 0 = BRONZE, 1 = SILVER, 2 = GOLD
   */
  async getTierConfig(tierIndex: 0 | 1 | 2): Promise<{
    minStakeAmount: string;
    roi90days: string;
    roi180days: string;
  }> {
    try {
      const provider = this.getAlchemyProvider();

      const stakingContract = new ethers.Contract(
        this.STAKING_CONTRACT_ADDRESS,
        LEXA_STAKING_ABI,
        provider
      );

      console.log(`⚙️ Getting tier ${tierIndex} configuration...`);

      const tierConfig = await stakingContract.getTierConfig(tierIndex);

      return {
        minStakeAmount: tierConfig.minStakeAmount.toString(),
        roi90days: tierConfig.roi90days.toString(),
        roi180days: tierConfig.roi180days.toString(),
      };
    } catch (error) {
      console.error(`❌ Error getting tier ${tierIndex} config:`, error);
      throw error;
    }
  }
}

export const stakingService = new StakingService();
