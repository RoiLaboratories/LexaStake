import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getFeeCollectorSignerConfig } from '@/utils/contractConfig';

/**
 * POST /api/swaps/collect-fee
 * Record 0.3% fee from swap output
 * 
 * ⚠️  IMPORTANT: This endpoint only RECORDS fees in the contract state.
 * It does NOT transfer tokens. The fee is tracked for accounting purposes.
 * 
 * Current Architecture:
 * 1. User executes swap through PancakeSwap → gets 100% output to wallet
 * 2. Frontend calls this endpoint → records 0.3% in contract state
 * 3. Actual fee tokens remain with user (no transfer happens)
 * 4. Admin can later call withdrawFees() to request fee payment
 * 
 * For actual token transfer (future enhancement), the swap flow would need to:
 * - Route output through intermediary contract
 * - Deduct 0.3% fee
 * - Send 99.7% to user, 0.3% to FeeCollector
 * 
 * Body: {
 *   token: "0x...",           // Output token address
 *   outputAmount: "100",      // Total output amount from swap
 *   userAddress: "0x...",     // User's wallet (for tracking)
 *   txHash: "0x..."           // Original swap transaction hash
 * }
 * 
 * Response: {
 *   success: true,
 *   feeAmount: "0.3",         // Calculated 0.3% fee
 *   recordedInState: true,    // Fee recorded in contract state
 *   actualTokensTransferred: false  // WARNING: No tokens actually transferred
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { token, outputAmount, userAddress, txHash } = await request.json();

    // Validate inputs
    if (!token || !ethers.isAddress(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      );
    }

    if (!outputAmount || isNaN(parseFloat(outputAmount))) {
      return NextResponse.json(
        { success: false, error: 'Invalid output amount' },
        { status: 400 }
      );
    }

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user address' },
        { status: 400 }
      );
    }

    if (!txHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction hash' },
        { status: 400 }
      );
    }

    // Get contract details
    const config = getFeeCollectorSignerConfig();
    if (!config.ok) {
      console.error('[swaps/collect-fee] Configuration error:', config.error);
      return NextResponse.json(
        { success: false, error: config.error },
        { status: 500 }
      );
    }

    // Setup blockchain interaction
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const owner = new ethers.Wallet(config.privateKey, provider);

    // Convert amount to wei (assuming standard 18 decimals)
    const outputAmountWei = ethers.parseEther(outputAmount);
    
    // Calculate the 0.3% fee (for logging purposes)
    const feePercentage = 30; // 0.3%
    const basisPoints = 10000; // 100%
    const feeAmountWei = (outputAmountWei * BigInt(feePercentage)) / BigInt(basisPoints);

    console.log(`💰 Recording 0.3% fee collection:`, {
      user: userAddress,
      token,
      outputAmount,
      feeAmountWei: feeAmountWei.toString(),
      feeFormatted: ethers.formatEther(feeAmountWei),
      txHash,
    });

    // Contract ABI - collectFee function
    const collectorAbi = [
      'function collectFee(address _token, uint256 _outputAmount, address _collector) returns (uint256)',
    ];

    const contract = new ethers.Contract(config.contractAddress, collectorAbi, owner);

    // Record the fee - assumes the 0.3% was already transferred to the contract during swap
    console.log(`📝 Recording fee in contract...`);
    const tx = await contract.collectFee(token, outputAmountWei, userAddress);
    const receipt = await tx.wait();

    console.log(`✅ Fee recorded on block ${receipt?.blockNumber}, tx: ${receipt?.hash}`);
    console.log(`💸 Fee amount (wei): ${feeAmountWei.toString()}`);
    console.log(`💸 Fee amount: ${ethers.formatEther(feeAmountWei)} tokens`);
    console.log(`📝 NOTE: This fee is recorded in contract state only. Actual token transfer to contract = NOT IMPLEMENTED`);

    return NextResponse.json({
      success: true,
      txHash: receipt?.hash,
      blockNumber: receipt?.blockNumber,
      feeAmount: ethers.formatEther(feeAmountWei),
      feeAmountWei: feeAmountWei.toString(),
      recordedInState: true,
      actualTokensTransferred: false,
      note: "Fee is tracked in contract state for accounting. Actual token transfer not yet implemented.",
    });
  } catch (error) {
    console.error('❌ Error collecting fee:', error);

    // Check if it's a contract error
    let errorMessage = 'Failed to collect fee';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('invalid address')) {
        errorMessage = 'Invalid token or collector address';
      } else if (errorMessage.includes('insufficient')) {
        errorMessage = 'Insufficient contract balance';
      } else if (errorMessage.includes('revert')) {
        errorMessage = 'Contract reverted: ' + errorMessage;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
