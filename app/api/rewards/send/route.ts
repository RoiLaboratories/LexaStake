import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * POST /api/rewards/send
 * Send 2% BNB reward to referrer after swap
 * 
 * Body: {
 *   referrer: "0x...",
 *   swapper: "0x...",
 *   amount: "0.02",  // in BNB
 *   txHash: "0x..."  // swap tx hash
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { referrer, swapper, amount, txHash } = await request.json();

    // Validate inputs
    if (!referrer || !ethers.isAddress(referrer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid referrer address' },
        { status: 400 }
      );
    }

    if (!swapper || !ethers.isAddress(swapper)) {
      return NextResponse.json(
        { success: false, error: 'Invalid swapper address' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
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
    const contractAddress = process.env.NEXT_PUBLIC_SWAP_REWARDS_CONTRACT;
    const ownerPrivateKey = process.env.PRIVATE_KEY;

    if (!contractAddress || !ownerPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'Contract not configured' },
        { status: 500 }
      );
    }

    // Setup blockchain interaction
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org:443';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const owner = new ethers.Wallet(ownerPrivateKey, provider);

    // Contract ABI
    const abi = [
      'function sendReward(address _referrer, address _swapper, uint256 _amount, string _txHash) external',
    ];

    const contract = new ethers.Contract(contractAddress, abi, owner);

    // Convert amount to wei - normalize to avoid floating point precision errors
    const amountNum = parseFloat(amount);
    const normalizedAmount = amountNum.toFixed(18); // Limit to 18 decimal places
    const amountWei = ethers.parseEther(normalizedAmount);

    console.log(`💰 Sending ${normalizedAmount} BNB reward to ${referrer}`);

    // Call contract
    const tx = await contract.sendReward(referrer, swapper, amountWei, txHash);
    const receipt = await tx.wait();

    console.log(`✅ Reward sent on block ${receipt?.blockNumber}, tx: ${receipt?.hash}`);
    console.log('📝 Note: Referral recording is handled by frontend via /api/referrals/record');

    return NextResponse.json({
      success: true,
      txHash: receipt?.hash,
      blockNumber: receipt?.blockNumber,
    });
  } catch (error) {
    console.error('❌ Error sending reward:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reward',
      },
      { status: 500 }
    );
  }
}
