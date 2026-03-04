-- Supabase Setup for Profile Management
-- This SQL creates the profiles table and sets up RLS policies

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address VARCHAR(42) NOT NULL UNIQUE,
  profile_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_address ON profiles(user_address);

-- Enable Row-Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON profiles;

-- Create RLS policy: Allow anyone to read profiles
CREATE POLICY "Allow public read access on profiles"
  ON profiles
  FOR SELECT
  USING (true);

-- Create RLS policy: Allow authenticated users to insert their own profile
CREATE POLICY "Allow users to insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Create RLS policy: Allow users to update their own profile
CREATE POLICY "Allow users to update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Grant permissions to authenticated users
GRANT SELECT ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;
GRANT UPDATE ON profiles TO authenticated;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_profiles_timestamp_trigger ON profiles;
CREATE TRIGGER update_profiles_timestamp_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();



