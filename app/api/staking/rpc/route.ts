import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';

/**
 * Server-side RPC endpoint for staking operations
 * This API route uses the private ALCHEMY_API_KEY to make RPC calls
 * Client cannot access this key directly
 */

function getAlchemyProvider(): JsonRpcProvider {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  
  if (!alchemyKey) {
    console.warn(
      "⚠️ Alchemy API key not found, falling back to public RPC"
    );
    return new JsonRpcProvider(
      process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc.meowrpc.com"
    );
  }

  const alchemyRpcUrl = `https://bsc-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  console.log("📡 Using Alchemy RPC for BSC operations (server-side)");
  return new JsonRpcProvider(alchemyRpcUrl);
}

/**
 * Handle RPC calls with the private Alchemy API key
 * POST /api/staking/rpc
 * 
 * Request body: { method: string, params: any[] }
 * Response: { result: any } or { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { method, params, contractAddress } = await request.json();

    if (!method) {
      return NextResponse.json(
        { error: "Missing method parameter" },
        { status: 400 }
      );
    }

    const provider = getAlchemyProvider();

    // Handle different RPC methods
    switch (method) {
      case 'call': {
        // For contract calls (allowance, etc)
        const { to, data } = params;
        const result = await provider.call({
          to,
          data,
        });
        return NextResponse.json({ result });
      }

      case 'getNetwork': {
        const network = await provider.getNetwork();
        return NextResponse.json({ 
          result: {
            chainId: network.chainId.toString(),
            name: network.name,
          }
        });
      }

      case 'sendTransaction': {
        // For signing transactions, just return the provider URL
        // Actual signing happens on client via window.ethereum
        const alchemyRpcUrl = `https://bsc-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
        return NextResponse.json({ rpcUrl: alchemyRpcUrl });
      }

      default:
        // For any other RPC method, forward to Alchemy
        const response = await provider.send(method, params);
        return NextResponse.json({ result: response });
    }
  } catch (error) {
    console.error("❌ RPC API error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "RPC call failed",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
