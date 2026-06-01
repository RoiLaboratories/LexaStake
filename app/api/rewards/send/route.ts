import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getSwapRewardsSignerConfig } from '@/utils/contractConfig';
import { TOKENS } from '@/constants/tokens';

const ERC20_REWARD_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

function parseDecimalUnits(amount: string, decimals: number) {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid amount');
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const normalized =
    decimals === 0
      ? whole
      : `${whole}.${fraction.slice(0, decimals).padEnd(decimals, '0')}`;
  const units = ethers.parseUnits(normalized, decimals);

  return {
    units,
    normalized: ethers.formatUnits(units, decimals),
  };
}

/**
 * POST /api/rewards/send
 * Send 2% reward to referrer after swap
 * 
 * Body: {
 *   referrer: "0x...",
 *   swapper: "0x...",
 *   amount: "0.02",
 *   txHash: "0x...",  // swap tx hash
 *   rewardToken: "BNB" | "USDT",
 *   tokenAddress: "0x..." // required for BEP20 rewards unless token is known
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      referrer,
      swapper,
      amount,
      txHash,
      rewardToken = 'BNB',
      tokenAddress,
    } = await request.json();
    const normalizedRewardToken = String(rewardToken).toUpperCase();

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

    if (!['BNB', 'USDT'].includes(normalizedRewardToken)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported reward token' },
        { status: 400 }
      );
    }

    // Get contract details
    const config = getSwapRewardsSignerConfig();
    if (!config.ok) {
      console.error('[rewards/send] Configuration error:', config.error);
      return NextResponse.json(
        { success: false, error: config.error },
        { status: 500 }
      );
    }

    // Setup blockchain interaction
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const owner = new ethers.Wallet(config.privateKey, provider);

    if (normalizedRewardToken === 'USDT') {
      const resolvedTokenAddress = tokenAddress || TOKENS.USDT.address;
      if (!ethers.isAddress(resolvedTokenAddress)) {
        return NextResponse.json(
          { success: false, error: 'Invalid reward token address' },
          { status: 400 }
        );
      }

      if (resolvedTokenAddress.toLowerCase() !== TOKENS.USDT.address.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Unsupported reward token address' },
          { status: 400 }
        );
      }

      const tokenContract = new ethers.Contract(
        resolvedTokenAddress,
        ERC20_REWARD_ABI,
        owner
      );
      const decimals = Number(await tokenContract.decimals());
      const { units: amountUnits, normalized: normalizedAmount } =
        parseDecimalUnits(String(amount), decimals);
      if (amountUnits <= BigInt(0)) {
        return NextResponse.json(
          { success: false, error: 'Amount must be greater than zero' },
          { status: 400 }
        );
      }

      console.log(`Sending ${normalizedAmount} ${normalizedRewardToken} reward to ${referrer}`);
      console.log(`Token: ${resolvedTokenAddress}`);
      console.log(`Signer: ${owner.address}`);

      const ownerBalance = await tokenContract.balanceOf(owner.address);
      console.log(`Distributor ${normalizedRewardToken} Balance: ${ethers.formatUnits(ownerBalance, decimals)}`);

      if (ownerBalance < amountUnits) {
        return NextResponse.json(
          {
            success: false,
            error: `Distributor insufficient ${normalizedRewardToken} balance: ${ethers.formatUnits(ownerBalance, decimals)} ${normalizedRewardToken} (need ${normalizedAmount} ${normalizedRewardToken}).`,
            distributorBalance: ethers.formatUnits(ownerBalance, decimals),
            requiredAmount: normalizedAmount,
          },
          { status: 400 }
        );
      }

      const tx = await tokenContract.transfer(referrer, amountUnits);
      const receipt = await tx.wait();

      if (!receipt) {
        return NextResponse.json(
          {
            success: false,
            error: 'Transaction failed - no receipt returned',
          },
          { status: 500 }
        );
      }

      console.log(`USDT reward sent on block ${receipt.blockNumber}, tx: ${receipt.hash}`);

      return NextResponse.json({
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        rewardToken: normalizedRewardToken,
      });
    }

    // Contract ABI
    const abi = [
      'function sendReward(address _referrer, address _swapper, uint256 _amount, string _txHash) external',
    ];

    const contract = new ethers.Contract(config.contractAddress, abi, owner);

    const { units: amountWei, normalized: normalizedAmount } =
      parseDecimalUnits(String(amount), 18);
    if (amountWei <= BigInt(0)) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    console.log(`💰 Sending ${normalizedAmount} BNB reward to ${referrer}`);
    console.log(`📍 Contract: ${config.contractAddress}`);
    console.log(`👤 Signer: ${owner.address}`);

    // Check contract balance before attempting transaction
    const contractBalance = await provider.getBalance(config.contractAddress);
    console.log(`💵 Contract Balance: ${ethers.formatEther(contractBalance)} BNB`);
    
    if (contractBalance < amountWei) {
      console.error(`❌ Contract has insufficient balance: ${ethers.formatEther(contractBalance)} < ${normalizedAmount}`);
      return NextResponse.json(
        {
          success: false,
          error: `Contract insufficient balance: ${ethers.formatEther(contractBalance)} BNB (need ${normalizedAmount} BNB). Please fund the contract.`,
          contractBalance: ethers.formatEther(contractBalance),
          requiredAmount: normalizedAmount,
        },
        { status: 400 }
      );
    }

    // Verify signer is contract owner (for debugging)
    try {
      const ownerAddress = await contract.owner?.() || 'Unknown';
      console.log(`✅ Contract Owner: ${ownerAddress}`);
      
      if (ownerAddress !== owner.address && ownerAddress !== 'Unknown') {
        console.warn(`⚠️  Signer ${owner.address} is not the owner ${ownerAddress}`);
      }
    } catch {
      console.log('ℹ️ Could not verify owner (contract may not have owner() function)');
    }

    // Call contract
    const tx = await contract.sendReward(referrer, swapper, amountWei, txHash);
    const receipt = await tx.wait();

    if (!receipt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction failed - no receipt returned',
        },
        { status: 500 }
      );
    }

    console.log(`✅ Reward sent on block ${receipt.blockNumber}, tx: ${receipt.hash}`);
    console.log('📝 Note: Referral recording is handled by frontend via /api/referrals/record');

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error('❌ Error sending reward:', error);
    
    // Extract specific error details
    let errorMessage = 'Failed to send reward';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for specific error types
      if (error.message.includes('insufficient balance') || error.message.includes('Insufficient balance')) {
        errorCode = 'INSUFFICIENT_BALANCE';
      } else if (error.message.includes('execution reverted')) {
        errorCode = 'CONTRACT_REVERTED';
      } else if (error.message.includes('nonce')) {
        errorCode = 'NONCE_ERROR';
      } else if (error.message.includes('gas')) {
        errorCode = 'GAS_ERROR';
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
        hint: 'Ensure: (1) Contract has BNB balance, (2) Owner private key is correct, (3) Addresses are valid',
      },
      { status: 500 }
    );
  }
}
