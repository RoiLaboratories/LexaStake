-- Supabase Database Schema for Referral System
-- This SQL creates the tables needed to track referral conversions and earnings

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist (for clean reinstall)
DROP TRIGGER IF EXISTS update_referrals_timestamp_trigger ON referrals;
DROP FUNCTION IF EXISTS update_referrals_timestamp();
DROP FUNCTION IF EXISTS get_user_referral_earnings(VARCHAR(42));
DROP TABLE IF EXISTS referrals CASCADE;

-- Referrals table - tracks all referral conversions (stakes and swaps)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_address VARCHAR(42) NOT NULL,  -- Ethereum wallet address
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_address VARCHAR(42) NOT NULL,  -- Ethereum wallet address
  type VARCHAR(20) NOT NULL,              -- 'stake' or 'swap'
  stake_amount VARCHAR(255),              -- Amount of LEXA staked (stake referrals only)
  swap_input_amount VARCHAR(255),         -- Input amount in BNB sent (swap referrals only)
  reward_amount VARCHAR(255) NOT NULL,    -- 50 LEXA for stakes, 2% of input BNB for swaps
  reward_token VARCHAR(20) NOT NULL,      -- 'LEXA' or 'BNB'
  tx_hash VARCHAR(255) NOT NULL UNIQUE,   -- Transaction hash
  status VARCHAR(50) DEFAULT 'pending',   -- Status: pending, completed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for faster queries
  CONSTRAINT unique_referral_conversion UNIQUE (referrer_address, referred_address, tx_hash)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_address ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_address ON referrals(referred_address);
CREATE INDEX IF NOT EXISTS idx_referrals_tx_hash ON referrals(tx_hash);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(type);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_token ON referrals(reward_token);
CREATE INDEX IF NOT EXISTS idx_referrals_type_status ON referrals(type, status);  -- For filtering pending swaps

-- Create a secure function to get referral earnings (SECURITY DEFINER for performance)
-- This function respects the authenticated user and only returns their data
CREATE OR REPLACE FUNCTION get_user_referral_earnings(user_address VARCHAR(42))
RETURNS TABLE(
  referrer_address VARCHAR(42),
  total_referrals BIGINT,
  completed_referrals BIGINT,
  pending_referrals BIGINT,
  total_earned NUMERIC,
  earned_completed NUMERIC,
  earned_pending NUMERIC,
  last_referral_date TIMESTAMP
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  SELECT 
    referrer_address,
    COUNT(*) as total_referrals,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_referrals,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_referrals,
    SUM(CAST(reward_amount AS NUMERIC)) as total_earned,
    SUM(CASE WHEN status = 'completed' THEN CAST(reward_amount AS NUMERIC) ELSE 0 END) as earned_completed,
    SUM(CASE WHEN status = 'pending' THEN CAST(reward_amount AS NUMERIC) ELSE 0 END) as earned_pending,
    MAX(created_at) as last_referral_date
  FROM referrals
  WHERE referrer_address = LOWER(user_address)
  GROUP BY referrer_address;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_referral_earnings(VARCHAR) TO authenticated;

-- Create a function to get swap-specific referral earnings
CREATE OR REPLACE FUNCTION get_swap_referral_earnings(user_address VARCHAR(42))
RETURNS TABLE(
  total_swap_referrals BIGINT,
  total_bnb_earned NUMERIC,
  pending_bnb NUMERIC,
  completed_bnb NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  SELECT 
    COUNT(*) as total_swap_referrals,
    SUM(CAST(reward_amount AS NUMERIC)) as total_bnb_earned,
    SUM(CASE WHEN status = 'pending' THEN CAST(reward_amount AS NUMERIC) ELSE 0 END) as pending_bnb,
    SUM(CASE WHEN status = 'completed' THEN CAST(reward_amount AS NUMERIC) ELSE 0 END) as completed_bnb
  FROM referrals
  WHERE referrer_address = LOWER(user_address) AND type = 'swap'
  GROUP BY referrer_address;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_swap_referral_earnings(VARCHAR) TO authenticated;

-- Create a function to get pending swap referrals for distribution (admin/backend only)
CREATE OR REPLACE FUNCTION get_pending_swap_rewards_for_distribution()
RETURNS TABLE(
  referrer_address VARCHAR(42),
  total_pending_amount NUMERIC,
  referral_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  SELECT 
    referrer_address,
    SUM(CAST(reward_amount AS NUMERIC)) as total_pending_amount,
    COUNT(*) as referral_count
  FROM referrals
  WHERE type = 'swap' AND status = 'pending'
  GROUP BY referrer_address
  ORDER BY total_pending_amount DESC;
$$;

-- Grant execute permission to service role only (for backend distribution)
GRANT EXECUTE ON FUNCTION get_pending_swap_rewards_for_distribution() TO service_role;

-- Enable RLS (Row Level Security) on referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Anyone can insert referral records (needed for API)
CREATE POLICY "Allow public insert on referrals" ON referrals
FOR INSERT
WITH CHECK (TRUE);

-- Users can only view their own referral data (as referrer)
CREATE POLICY "Users can view own referral earnings" ON referrals
FOR SELECT
USING (referrer_address = LOWER(CURRENT_USER) OR auth.uid() IS NULL);

-- Allow viewing referrals where user is the referred party
CREATE POLICY "Users can view their referrals" ON referrals
FOR SELECT
USING (referred_address = LOWER(CURRENT_USER) OR auth.uid() IS NULL);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_referrals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referrals_timestamp_trigger
BEFORE UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION update_referrals_timestamp();
