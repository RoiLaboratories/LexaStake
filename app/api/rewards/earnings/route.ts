import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * GET /api/rewards/earnings?address=0x...
 * Get total BNB earned by a referrer
 */
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address' },
        { status: 400 }
      );
    }

    const contractAddress = process.env.NEXT_PUBLIC_SWAP_REWARDS_CONTRACT;
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, error: 'Contract not configured' },
        { status: 500 }
      );
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org:443';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const abi = ['function getReferrerEarnings(address) external view returns (uint256)'];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const earnings = await contract.getReferrerEarnings(address);

    return NextResponse.json({
      success: true,
      data: {
        address,
        totalEarnings: ethers.formatEther(earnings),
        unit: 'BNB',
      },
    });
  } catch (error) {
    console.error('❌ Error getting earnings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get earnings',
      },
      { status: 500 }
    );
  }
}
