import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase environment variables not configured. Database operations will fail."
  );
}

// Client for authenticated operations (uses JWT from auth)
export const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Service role client for server-side operations (has full access)
export const supabaseServiceClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export interface StakingHistoryRecord {
  user_id?: string;
  user_address: string;
  stake_index: number;
  amount: string; // In LEXA tokens
  tier: "Bronze" | "Silver" | "Gold";
  lock_period: number; // In days
  roi_percentage: number;
  start_time: number; // Unix timestamp
  lock_end_time: number; // Unix timestamp
  active?: boolean;
  tx_hash: string;
}

export interface TransactionRecord {
  user_id?: string;
  user_address: string;
  tx_hash: string;
  tx_type: "stake" | "unstake" | "claim_rewards" | "restake" | "swap";
  status?: "pending" | "confirmed" | "failed";
  amount?: string;
  details?: Record<string, any>;
}

class SupabaseService {
  /**
   * Get or create user by wallet address
   */
  async getOrCreateUser(walletAddress: string) {
    try {
      if (!supabaseClient) {
        console.warn("Supabase client not initialized");
        return null;
      }

      // Try to get existing user
      const { data: existingUser, error: selectError } = await supabaseClient
        .from("users")
        .select("id")
        .eq("wallet_address", walletAddress)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        // PGRST116 = "not found", which is expected
        throw selectError;
      }

      if (existingUser) {
        console.log("✓ User found:", existingUser.id);
        return existingUser.id;
      }

      // Create new user
      console.log("👤 Creating new user for wallet:", walletAddress);
      const { data: newUser, error: insertError } = await supabaseClient
        .from("users")
        .insert([{ wallet_address: walletAddress }])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log("✓ User created:", newUser.id);
      return newUser.id;
    } catch (error) {
      console.error("❌ Error getting or creating user:", error);
      return null;
    }
  }

  /**
   * Record a staking transaction via API route (server-side with proper auth)
   */
  async recordStaking(
    record: StakingHistoryRecord,
    walletAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("📝 Recording staking transaction via API...");

      // Call the server-side API route that handles database operations
      const response = await fetch("/api/staking/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          stake_index: record.stake_index,
          amount: record.amount,
          tier: record.tier,
          lock_period: record.lock_period,
          roi_percentage: record.roi_percentage,
          start_time: record.start_time,
          lock_end_time: record.lock_end_time,
          tx_hash: record.tx_hash,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "❌ Error recording staking (API):",
          errorData.error || response.statusText
        );
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.success) {
        console.log("✓ Staking record saved to database:", result.data);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("❌ Error recording staking:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get user's staking history
   */
  async getUserStakingHistory(walletAddress: string) {
    try {
      if (!supabaseClient) {
        return null;
      }

      console.log("📋 Fetching staking history for:", walletAddress);

      const { data, error } = await supabaseClient
        .from("staking_history")
        .select("*")
        .eq("user_address", walletAddress)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching staking history:", error);
        return null;
      }

      console.log("✓ Staking history fetched:", data?.length || 0, "records");
      return data;
    } catch (error) {
      console.error("❌ Error getting staking history:", error);
      return null;
    }
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(walletAddress: string) {
    try {
      if (!supabaseClient) {
        return null;
      }

      console.log("📋 Fetching transactions for:", walletAddress);

      const { data, error } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("user_address", walletAddress)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching transactions:", error);
        return null;
      }

      console.log("✓ Transactions fetched:", data?.length || 0, "records");
      return data;
    } catch (error) {
      console.error("❌ Error getting transactions:", error);
      return null;
    }
  }

  /**
   * Update staking record (mark as inactive/unstaked)
   */
  async updateStakingStatus(
    txHash: string,
    active: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseClient) {
        return {
          success: false,
          error: "Supabase client not initialized",
        };
      }

      console.log("🔄 Updating staking status for tx:", txHash);

      const { error } = await supabaseClient
        .from("staking_history")
        .update({ active })
        .eq("tx_hash", txHash);

      if (error) {
        console.error("❌ Error updating staking status:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✓ Staking status updated");
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating staking status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record a transaction (rewards claim, unstake, etc.)
   */
  async recordTransaction(
    record: TransactionRecord,
    walletAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseClient) {
        return {
          success: false,
          error: "Supabase client not initialized",
        };
      }

      console.log("🔗 Recording transaction:", record.tx_type);

      // Get or create user
      const userId = await this.getOrCreateUser(walletAddress);
      if (!userId) {
        return {
          success: false,
          error: "Failed to create/get user",
        };
      }

      const { error } = await supabaseClient
        .from("transactions")
        .insert([
          {
            user_id: userId,
            user_address: walletAddress,
            tx_hash: record.tx_hash,
            tx_type: record.tx_type,
            status: record.status || "confirmed",
            amount: record.amount,
            details: record.details,
          },
        ]);

      if (error) {
        console.error("❌ Error inserting transaction:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✓ Transaction recorded");
      return { success: true };
    } catch (error) {
      console.error("❌ Error recording transaction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record a referral conversion
   */
  async recordReferral(
    referrerAddress: string,
    referredAddress: string,
    stakeAmount: string,
    txHash: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("👥 Recording referral via API...");

      // Normalize addresses to lowercase for consistency
      const normalizedReferrer = referrerAddress.toLowerCase();
      const normalizedReferred = referredAddress.toLowerCase();

      console.log(`📝 Addresses: Referrer=${normalizedReferrer}, Referred=${normalizedReferred}`);

      // Call the server-side API route that handles referral recording
      const response = await fetch("/api/referrals/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "stake", // Required: specify this is a stake referral
          referrer_address: normalizedReferrer,
          referred_address: normalizedReferred,
          stake_amount: stakeAmount,
          tx_hash: txHash,
          reward_amount: "50", // 50 LEXA reward per referral
          reward_token: "LEXA", // Required: specify reward token
          status: "pending", // Status is pending until smart contract processes it
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "❌ Error recording referral (API):",
          errorData.error || response.statusText
        );
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.success) {
        console.log("✓ Referral recorded:", result.data);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("❌ Error recording referral:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Record a swap referral conversion
   * @param swapInputAmount - The amount of BNB spent (input to the swap)
   */
  async recordSwapReferral(
    referrerAddress: string,
    referredAddress: string,
    swapInputAmount: string,
    txHash: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("🔄 Recording swap referral via API...");

      // Normalize addresses to lowercase for consistency
      const normalizedReferrer = referrerAddress.toLowerCase();
      const normalizedReferred = referredAddress.toLowerCase();

      // Calculate 2% reward of the INPUT BNB amount
      const inputAmount = parseFloat(swapInputAmount);
      const rewardAmount = (inputAmount * 0.02).toString();

      console.log(`💰 Swap referral: Input=${inputAmount} BNB, Reward=${rewardAmount} BNB (2%)`);
      console.log(`📝 Addresses: Referrer=${normalizedReferrer}, Referred=${normalizedReferred}`);

      // Call the server-side API route that handles referral recording
      const response = await fetch("/api/referrals/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referrer_address: normalizedReferrer,
          referred_address: normalizedReferred,
          type: "swap",
          swap_input_amount: swapInputAmount,
          reward_amount: rewardAmount,
          reward_token: "BNB",
          tx_hash: txHash,
          status: "pending", // Status is pending until reward is distributed
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "❌ Error recording swap referral (API):",
          errorData.error || response.statusText
        );
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.success) {
        console.log("✓ Swap referral recorded:", result.data);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("❌ Error recording swap referral:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get referral earnings for a user (secure)
   * Uses a SECURITY DEFINER function that ensures users can only see their own earnings
   */
  async getReferralEarnings(walletAddress: string) {
    try {
      if (!supabaseClient) {
        return null;
      }

      console.log("💰 Fetching referral earnings for:", walletAddress);

      // Call the secure SQL function that respects the user's permissions
      const { data, error } = await supabaseClient
        .rpc("get_user_referral_earnings", {
          user_address: walletAddress.toLowerCase(),
        });

      if (error) {
        console.error("❌ Error fetching referral earnings:", error);
        return null;
      }

      // The function returns a single row with aggregated data
      const earningsData = data && data.length > 0 ? data[0] : null;

      if (earningsData) {
        console.log("✓ Referral earnings fetched:", {
          totalEarnings: earningsData.total_earned,
          totalReferrals: earningsData.total_referrals,
          statuses: {
            pending: earningsData.pending_referrals,
            completed: earningsData.completed_referrals,
          },
        });

        return {
          referrals: null, // Get individual referrals separately if needed
          totalEarnings: earningsData.total_earned || 0,
          totalReferrals: earningsData.total_referrals || 0,
          statuses: {
            pending: earningsData.pending_referrals || 0,
            completed: earningsData.completed_referrals || 0,
            failed: 0,
          },
          lastReferralDate: earningsData.last_referral_date,
        };
      }

      return {
        referrals: null,
        totalEarnings: 0,
        totalReferrals: 0,
        statuses: { pending: 0, completed: 0, failed: 0 },
        lastReferralDate: null,
      };
    } catch (error) {
      console.error("❌ Error getting referral earnings:", error);
      return null;
    }
  }

  /**
   * Get swap-specific referral earnings for a user
   */
  async getSwapReferralEarnings(walletAddress: string) {
    try {
      if (!supabaseClient) {
        return null;
      }

      console.log("💰 Fetching swap referral earnings for:", walletAddress);

      // Call the secure SQL function for swap earnings
      const { data, error } = await supabaseClient
        .rpc("get_swap_referral_earnings", {
          user_address: walletAddress.toLowerCase(),
        });

      if (error) {
        console.error("❌ Error fetching swap referral earnings:", error);
        return null;
      }

      // The function returns a single row with aggregated data
      const earningsData = data && data.length > 0 ? data[0] : null;

      if (earningsData) {
        console.log("✓ Swap referral earnings fetched:", {
          totalSwapReferrals: earningsData.total_swap_referrals,
          totalBnbEarned: earningsData.total_bnb_earned,
          pendingBnb: earningsData.pending_bnb,
          completedBnb: earningsData.completed_bnb,
        });

        return {
          referrals: null,
          totalEarnings: earningsData.total_bnb_earned || 0,
          totalReferrals: earningsData.total_swap_referrals || 0,
          statuses: {
            pending: earningsData.pending_bnb || 0,
            completed: earningsData.completed_bnb || 0,
            failed: 0,
          },
          lastReferralDate: earningsData.last_referral_date,
        };
      }

      return {
        referrals: null,
        totalEarnings: 0,
        totalReferrals: 0,
        statuses: { pending: 0, completed: 0, failed: 0 },
        lastReferralDate: null,
      };
    } catch (error) {
      console.error("❌ Error getting swap referral earnings:", error);
      return null;
    }
  }

  /**
   * Get all referrals made by a user (both stakes and swaps)
   */
  async getUserReferrals(walletAddress: string) {
    try {
      if (!supabaseClient) {
        return [];
      }

      console.log("📋 Fetching all referrals for:", walletAddress);

      const { data, error } = await supabaseClient
        .from("referrals")
        .select("*")
        .eq("referrer_address", walletAddress.toLowerCase())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching referrals:", error);
        return [];
      }

      if (data) {
        console.log(`✓ Fetched ${data.length} referrals`);
        return data.map((referral: any) => ({
          id: referral.id,
          referredAddress: referral.referred_address,
          type: referral.type, // 'stake' or 'swap'
          amount: referral.type === 'stake' ? referral.stake_amount : referral.swap_input_amount,
          rewardAmount: referral.reward_amount,
          rewardToken: referral.reward_token,
          status: referral.status, // 'pending', 'completed', 'failed'
          txHash: referral.tx_hash,
          createdAt: referral.created_at,
        }));
      }

      return [];
    } catch (error) {
      console.error("❌ Error getting user referrals:", error);
      return [];
    }
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(
    referrerAddress: string,
    referredAddress: string,
    txHash: string,
    status: "active" | "successful" | "failed" = "active"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseClient) {
        return { success: false, error: "Supabase client not initialized" };
      }

      console.log(`📊 Updating referral status to '${status}' for tx ${txHash}`);
      console.log(`   Referrer: ${referrerAddress.toLowerCase()}, Referred: ${referredAddress.toLowerCase()}`);

      // First, try to find the referral by tx_hash (should be unique)
      const { data: existingReferral, error: fetchError } = await supabaseClient
        .from("referrals")
        .select("id, tx_hash, referrer_address, referred_address, status")
        .eq("tx_hash", txHash)
        .single();

      if (fetchError) {
        console.warn(`⚠️ Could not find referral with tx_hash ${txHash}:`, fetchError.message);
        // Try alternate query with addresses as backup
        const { error: updateError } = await supabaseClient
          .from("referrals")
          .update({ status })
          .eq("tx_hash", txHash)
          .eq("referrer_address", referrerAddress.toLowerCase())
          .eq("referred_address", referredAddress.toLowerCase());

        if (updateError) {
          console.error(`❌ Error updating referral status with alternate query:`, updateError);
          return { success: false, error: updateError.message };
        }
        return { success: true };
      }

      console.log(`✓ Found referral record:`, {
        id: existingReferral.id,
        txHash: existingReferral.tx_hash,
        currentStatus: existingReferral.status,
        newStatus: status,
      });

      // Update the status
      const { error: updateError } = await supabaseClient
        .from("referrals")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", existingReferral.id);

      if (updateError) {
        console.error(`❌ Error updating referral status:`, updateError);
        return { success: false, error: updateError.message };
      }

      console.log(`✓ Referral status updated from '${existingReferral.status}' to '${status}'`);
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating referral status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const supabaseService = new SupabaseService();
