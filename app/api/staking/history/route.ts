import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const walletAddress = request.nextUrl.searchParams.get("wallet_address");
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "wallet_address is required" },
        { status: 400 },
      );
    }

    const normalizedWalletAddress = walletAddress.toLowerCase();
    const { data, error } = await supabaseAdmin
      .from("staking_history")
      .select("*")
      .ilike("user_address", normalizedWalletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching staking history:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch staking history" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Error in staking history API:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
