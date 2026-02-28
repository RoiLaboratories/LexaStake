import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase service client (server-side with full access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "⚠️ Supabase credentials not configured for API route"
  );
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * POST /api/staking/record
 * Record a staking transaction to the database
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      wallet_address,
      stake_index,
      amount,
      tier,
      lock_period,
      roi_percentage,
      start_time,
      lock_end_time,
      tx_hash,
    } = body;

    // Validate required fields
    if (!wallet_address || !tx_hash) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create user
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", wallet_address)
      .single();

    let userId = existingUser?.id;

    if (!userId) {
      // Create new user
      const { data: newUser, error: createUserError } = await supabaseAdmin
        .from("users")
        .insert([{ wallet_address }])
        .select("id")
        .single();

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        return NextResponse.json(
          { success: false, error: "Failed to create user" },
          { status: 500 }
        );
      }

      userId = newUser?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Failed to get or create user" },
        { status: 500 }
      );
    }

    // Record staking transaction
    const { data: stakingRecord, error: recordError } = await supabaseAdmin
      .from("staking_history")
      .insert([
        {
          user_id: userId,
          user_address: wallet_address,
          stake_index,
          amount,
          tier,
          lock_period,
          roi_percentage,
          start_time,
          lock_end_time,
          tx_hash,
          active: true,
        },
      ])
      .select()
      .single();

    if (recordError) {
      console.error("Error recording staking:", recordError);
      return NextResponse.json(
        { success: false, error: "Failed to record staking transaction" },
        { status: 500 }
      );
    }

    console.log("✓ Staking record saved to database:", stakingRecord);
    return NextResponse.json({ success: true, data: stakingRecord });
  } catch (error) {
    console.error("❌ Error in staking record API:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
