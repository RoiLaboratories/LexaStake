/**
 * Swap Fee Collector Service
 * 
 * Handles 0.3% fee collection from all swap outputs
 */

interface FeeCollectionResponse {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  feeAmount?: string;
  error?: string;
}

class SwapFeeCollectorService {
  /**
   * Record 0.3% fee collection from swap output
   * NOTE: The fee is deducted during the swap itself - this just records it in the contract
   * 
   * @param token - Output token address
   * @param outputAmount - Total output amount from swap BEFORE fee deduction (in decimal form)
   * @param userAddress - User's wallet address
   * @param txHash - Original swap transaction hash
   * @returns Fee collection response
   */
  async collectFee(
    token: string,
    outputAmount: string,
    userAddress: string,
    txHash: string
  ): Promise<FeeCollectionResponse> {
    try {
      console.log('💰 [FeeCollector] Initiating fee collection:', {
        token,
        outputAmount,
        userAddress,
        txHash,
      });

      const response = await fetch('/api/swaps/collect-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          outputAmount,
          userAddress,
          txHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [FeeCollector] Failed to collect fee:', error);
        return {
          success: false,
          error: error.error || 'Failed to collect fee',
        };
      }

      const result = await response.json();
      console.log('✅ [FeeCollector] Fee collected successfully:', {
        txHash: result.txHash,
        feeAmount: result.feeAmount,
        blockNumber: result.blockNumber,
      });

      return {
        success: true,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        feeAmount: result.feeAmount,
      };
    } catch (error) {
      console.error('❌ [FeeCollector] Error collecting fee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate 0.3% fee from output amount
   * 
   * @param outputAmount - Total output amount
   * @returns Calculated fee (0.3% of output)
   */
  calculateFee(outputAmount: string): string {
    try {
      const amount = parseFloat(outputAmount);
      if (isNaN(amount) || amount <= 0) {
        return '0';
      }

      // 0.3% = 30 basis points / 10000
      const feePercentage = 30; // 0.3%
      const basisPoints = 10000; // 100%
      const fee = (amount * feePercentage) / basisPoints;

      return fee.toFixed(18); // Return with full precision
    } catch (error) {
      console.error('❌ [FeeCollector] Error calculating fee:', error);
      return '0';
    }
  }

  /**
   * Format fee amount for display
   * 
   * @param feeAmount - Fee amount as string
   * @param decimals - Number of decimals to display (default: 8)
   * @returns Formatted fee string
   */
  formatFeeForDisplay(feeAmount: string, decimals: number = 8): string {
    try {
      const fee = parseFloat(feeAmount);
      if (isNaN(fee)) {
        return '0';
      }

      // Only show significant decimals
      if (fee === 0) {
        return '0';
      }

      // For very small amounts, use more decimals
      if (fee < 0.0001) {
        return fee.toExponential(2);
      }

      return fee.toFixed(decimals).replace(/\.?0+$/, '');
    } catch (error) {
      return '0';
    }
  }

  /**
   * Estimate total fee collected from a swap
   * 
   * @param outputAmount - Output amount from swap
   * @param decimals - Token decimals for display
   * @returns Object with fee info
   */
  estimateFeeInfo(outputAmount: string, decimals: number = 8) {
    const fee = this.calculateFee(outputAmount);
    const formattedFee = this.formatFeeForDisplay(fee, decimals);

    return {
      outputAmount,
      feePercentage: '0.3%',
      feeAmount: fee,
      formattedFee,
      userReceives: (parseFloat(outputAmount) - parseFloat(fee)).toString(),
    };
  }
}

export const swapFeeCollectorService = new SwapFeeCollectorService();
