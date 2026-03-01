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
 * POST /api/referrals/record
 * Record a referral conversion to the database
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
      referrer_address,
      referred_address,
      type,
      stake_amount,
      swap_input_amount,
      tx_hash,
      reward_amount,
      reward_token,
      status,
    } = body;

    // Validate required fields
    if (!referrer_address || !referred_address || !tx_hash || !type || !reward_amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (need: referrer_address, referred_address, type, reward_amount, tx_hash)" },
        { status: 400 }
      );
    }

    // Validate type is either 'stake' or 'swap'
    if (type !== 'stake' && type !== 'swap') {
      return NextResponse.json(
        { success: false, error: "Type must be 'stake' or 'swap'" },
        { status: 400 }
      );
    }

    // Validate stake_amount is provided for stake referrals
    if (type === 'stake' && !stake_amount) {
      return NextResponse.json(
        { success: false, error: "stake_amount required for stake referrals" },
        { status: 400 }
      );
    }

    // Validate swap_input_amount is provided for swap referrals
    if (type === 'swap' && !swap_input_amount) {
      return NextResponse.json(
        { success: false, error: "swap_input_amount required for swap referrals" },
        { status: 400 }
      );
    }

    // Prevent self-referrals
    if (referrer_address.toLowerCase() === referred_address.toLowerCase()) {
      console.warn("⚠️ Self-referral attempt blocked");
      return NextResponse.json(
        { success: false, error: "Cannot refer yourself" },
        { status: 400 }
      );
    }

    // Get or create referrer user
    const { data: existingReferrer } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", referrer_address)
      .single();

    let referrerId = existingReferrer?.id;

    if (!referrerId) {
      // Create referrer user
      const { data: newReferrer, error: createReferrerError } = await supabaseAdmin
        .from("users")
        .insert([{ wallet_address: referrer_address }])
        .select("id")
        .single();

      if (createReferrerError) {
        console.error("Error creating referrer user:", createReferrerError);
        return NextResponse.json(
          { success: false, error: "Failed to create referrer user" },
          { status: 500 }
        );
      }

      referrerId = newReferrer?.id;
    }

    // Get or create referred user
    const { data: existingReferred } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("wallet_address", referred_address)
      .single();

    let referredId = existingReferred?.id;

    if (!referredId) {
      // Create referred user
      const { data: newReferred, error: createReferredError } = await supabaseAdmin
        .from("users")
        .insert([{ wallet_address: referred_address }])
        .select("id")
        .single();

      if (createReferredError) {
        console.error("Error creating referred user:", createReferredError);
        return NextResponse.json(
          { success: false, error: "Failed to create referred user" },
          { status: 500 }
        );
      }

      referredId = newReferred?.id;
    }

    if (!referrerId || !referredId) {
      return NextResponse.json(
        { success: false, error: "Failed to get or create users" },
        { status: 500 }
      );
    }

    // Record referral conversion
    const { data: referralRecord, error: recordError } = await supabaseAdmin
      .from("referrals")
      .insert([
        {
          referrer_id: referrerId,
          referrer_address: referrer_address.toLowerCase(),
          referred_id: referredId,
          referred_address: referred_address.toLowerCase(),
          type: type,
          stake_amount: type === 'stake' ? stake_amount : null,
          swap_input_amount: type === 'swap' ? swap_input_amount : null,
          reward_amount: reward_amount,
          reward_token: reward_token || (type === 'stake' ? 'LEXA' : 'BNB'),
          tx_hash,
          status: status || "pending",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (recordError) {
      console.error("Error recording referral:", recordError);
      // If the table doesn't exist yet, log a warning but don't fail
      if (recordError.code === "42P01") {
        console.warn("⚠️ Referrals table does not exist yet. Continuing without recording.");
        // Return success anyway - the referral link is still valid
        return NextResponse.json({
          success: true,
          data: null,
          message: "Referral recorded in blockchain, table pending creation",
        });
      }
      return NextResponse.json(
        { success: false, error: "Failed to record referral" },
        { status: 500 }
      );
    }

    console.log("✓ Referral record saved to database:", referralRecord);
    return NextResponse.json({ success: true, data: referralRecord });
  } catch (error) {
    console.error("❌ Error in referral record API:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
