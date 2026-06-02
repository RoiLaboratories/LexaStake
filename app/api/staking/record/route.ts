import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials not configured for staking record API route");
}

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

async function getOrCreateUserId(walletAddress: string) {
  if (!supabaseAdmin) return null;

  const { data: existingUser, error: selectError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingUser?.id) {
    return existingUser.id as string;
  }

  const { data: newUser, error: createUserError } = await supabaseAdmin
    .from("users")
    .insert([{ wallet_address: walletAddress }])
    .select("id")
    .single();

  if (createUserError) {
    throw createUserError;
  }

  return newUser?.id as string | undefined;
}

async function recordStakeActivity(input: {
  userId: string;
  walletAddress: string;
  txHash: string;
  amount: string;
  tier: string;
  lockPeriod: number;
  roiPercentage: number;
}) {
  if (!supabaseAdmin) return false;

  const { data: existingTransaction, error: checkError } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .ilike("tx_hash", input.txHash)
    .maybeSingle();

  if (checkError) {
    if (checkError.code === "42P01") {
      console.warn("Transactions table does not exist yet. Skipping activity record.");
      return false;
    }
    throw checkError;
  }

  if (existingTransaction) {
    return true;
  }

  const { error: activityError } = await supabaseAdmin.from("transactions").insert([
    {
      user_id: input.userId,
      user_address: input.walletAddress,
      tx_hash: input.txHash,
      tx_type: "stake",
      status: "confirmed",
      amount: input.amount,
      details: {
        tier: input.tier,
        duration: input.lockPeriod,
        roi: input.roiPercentage,
      },
    },
  ]);

  if (activityError) {
    if (activityError.code === "42P01") {
      console.warn("Transactions table does not exist yet. Skipping activity record.");
      return false;
    }
    throw activityError;
  }

  return true;
}

/**
 * POST /api/staking/record
 * Record a staking transaction and matching activity row using the service role.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 500 },
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

    if (!wallet_address || !tx_hash) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedWalletAddress = String(wallet_address).toLowerCase();
    const normalizedTxHash = String(tx_hash).toLowerCase();
    const userId = await getOrCreateUserId(normalizedWalletAddress);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Failed to get or create user" },
        { status: 500 },
      );
    }

    const activityRecorded = await recordStakeActivity({
      userId,
      walletAddress: normalizedWalletAddress,
      txHash: normalizedTxHash,
      amount,
      tier,
      lockPeriod: lock_period,
      roiPercentage: roi_percentage,
    });

    const { data: existingStake, error: existingStakeError } = await supabaseAdmin
      .from("staking_history")
      .select("*")
      .ilike("tx_hash", normalizedTxHash)
      .maybeSingle();

    if (existingStakeError) {
      console.error("Error checking existing staking record:", existingStakeError);
      return NextResponse.json(
        { success: false, error: "Failed to validate staking transaction" },
        { status: 500 },
      );
    }

    if (existingStake) {
      return NextResponse.json({
        success: true,
        data: existingStake,
        activityRecorded,
        duplicate: true,
      });
    }

    const { data: stakingRecord, error: recordError } = await supabaseAdmin
      .from("staking_history")
      .insert([
        {
          user_id: userId,
          user_address: normalizedWalletAddress,
          stake_index,
          amount,
          tier,
          lock_period,
          roi_percentage,
          start_time,
          lock_end_time,
          tx_hash: normalizedTxHash,
          active: true,
        },
      ])
      .select()
      .single();

    if (recordError) {
      console.error("Error recording staking:", recordError);
      return NextResponse.json(
        { success: false, error: "Failed to record staking transaction" },
        { status: 500 },
      );
    }

    console.log("Staking record saved to database:", stakingRecord);
    return NextResponse.json({
      success: true,
      data: stakingRecord,
      activityRecorded,
    });
  } catch (error) {
    console.error("Error in staking record API:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
