import { ethers } from 'ethers';

/**
 * Swap Referral Rewards Service
 * 
 * Simple service to send 2% BNB rewards directly to referrers
 * No oracle, no pending status - just send the reward immediately
 */

class SwapRewardsSender {
  private contractAddress: string;
  private provider: ethers.JsonRpcProvider;

  constructor(contractAddress: string = process.env.NEXT_PUBLIC_SWAP_REWARDS_CONTRACT || '') {
    this.contractAddress = contractAddress;
    this.provider = new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org:443'
    );
  }

  /**
   * Send 2% BNB reward to referrer
   * Calls the contract's sendReward function (owner-only)
   * 
   * Note: This should be called from the backend/API, not directly from client
   */
  async sendRewardViaAPI(
    referrerAddress: string,
    swapperAddress: string,
    rewardAmountBNB: string,
    txHash: string
  ): Promise<{ success: boolean; error?: string; txHash?: string }> {
    try {
      // Call backend API to send reward (backend has owner private key)
      const response = await fetch('/api/rewards/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrer: referrerAddress,
          swapper: swapperAddress,
          amount: rewardAmountBNB,
          txHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || 'Failed to send reward',
        };
      }

      const result = await response.json();
      return {
        success: true,
        txHash: result.txHash,
      };
    } catch (error) {
      console.error('❌ Error sending reward:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current contract balance
   */
  async getContractBalance(): Promise<string> {
    try {
      const balance = await this.provider.getBalance(this.contractAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('❌ Error getting contract balance:', error);
      return '0';
    }
  }

  /**
   * Get total rewards earned by a referrer
   */
  async getReferrerEarnings(referrerAddress: string): Promise<string> {
    try {
      const abi = ['function getReferrerEarnings(address) external view returns (uint256)'];
      const contract = new ethers.Contract(this.contractAddress, abi, this.provider);
      const earnings = await contract.getReferrerEarnings(referrerAddress);
      return ethers.formatEther(earnings);
    } catch (error) {
      console.error('❌ Error getting referrer earnings:', error);
      return '0';
    }
  }
}

export const swapRewardsSender = new SwapRewardsSender();
