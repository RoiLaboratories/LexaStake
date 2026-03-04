import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * POST /api/swaps/collect-fee
 * Record 0.3% fee collection that was deducted during swap
 * 
 * The swap handler is responsible for:
 * 1. Calculating the 0.3% fee from output
 * 2. Sending that fee directly to the SwapFeeCollector contract
 * 3. Sending the remaining amount (97%) to the user
 * 
 * This endpoint simply records the fee in the contract's tracking systems
 * 
 * Body: {
 *   token: "0x...",           // Output token address (e.g., LEXA)
 *   outputAmount: "100",      // Total output amount BEFORE fee deduction
 *   userAddress: "0x...",     // User's wallet address (for reference)
 *   txHash: "0x..."           // Original swap transaction hash
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
    const contractAddress = process.env.NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS;
    const ownerPrivateKey = process.env.PRIVATE_KEY;

    if (!contractAddress || !ownerPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'Fee collector contract not configured' },
        { status: 500 }
      );
    }

    // Setup blockchain interaction
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org:443';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const owner = new ethers.Wallet(ownerPrivateKey, provider);

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

    const contract = new ethers.Contract(contractAddress, collectorAbi, owner);

    // Record the fee - assumes the 0.3% was already transferred to the contract during swap
    console.log(`📝 Recording fee in contract...`);
    const tx = await contract.collectFee(token, outputAmountWei, userAddress);
    const receipt = await tx.wait();

    console.log(`✅ Fee recorded on block ${receipt?.blockNumber}, tx: ${receipt?.hash}`);
    console.log(`💸 Fee amount (wei): ${feeAmountWei.toString()}`);
    console.log(`💸 Fee amount: ${ethers.formatEther(feeAmountWei)} tokens`);

    return NextResponse.json({
      success: true,
      txHash: receipt?.hash,
      blockNumber: receipt?.blockNumber,
      feeAmount: ethers.formatEther(feeAmountWei),
      feeAmountWei: feeAmountWei.toString(),
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
