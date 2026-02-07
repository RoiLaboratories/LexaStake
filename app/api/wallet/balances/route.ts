import { NextRequest, NextResponse } from "next/server";
import { blockchainService } from "@/services/blockchain.service";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 },
      );
    }

    const balances = await blockchainService.getLexaAndBNBBalances(
      walletAddress,
    );

    return NextResponse.json(balances);
  } catch (error) {
    console.error("Error fetching balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 },
    );
  }
}
