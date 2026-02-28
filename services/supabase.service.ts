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
}

export const supabaseService = new SupabaseService();
