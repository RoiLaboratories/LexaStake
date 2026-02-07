import { NextRequest, NextResponse } from "next/server";
import { blockchainService } from "@/services/blockchain.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, tokenAddress } = body;

    console.log("Balance API called with:", { walletAddress, tokenAddress });

    if (!walletAddress || !tokenAddress) {
      console.error("Missing required parameters");
      return NextResponse.json(
        { error: "Missing walletAddress or tokenAddress" },
        { status: 400 },
      );
    }

    console.log("Calling blockchainService.getTokenBalance...");
    const balance = await blockchainService.getTokenBalance(
      walletAddress,
      tokenAddress,
    );

    console.log("Successfully fetched balance:", balance);
    return NextResponse.json({ balance });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Error in /api/wallet/balance:", errorMessage);
    console.error("Stack trace:", errorStack);
    return NextResponse.json(
      { 
        error: "Failed to fetch balance", 
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 },
    );
  }
}
