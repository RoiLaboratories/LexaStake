import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getSwapRewardsReadConfig } from '@/utils/contractConfig';

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

    const config = getSwapRewardsReadConfig();
    if (!config.ok) {
      console.error('[rewards/earnings] Configuration error:', config.error);
      return NextResponse.json(
        { success: false, error: config.error },
        { status: 500 }
      );
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    const abi = ['function getReferrerEarnings(address) external view returns (uint256)'];
    const contract = new ethers.Contract(config.contractAddress, abi, provider);

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
