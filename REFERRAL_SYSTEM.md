# Referral System Implementation Guide

## Overview

The referral system allows users to earn rewards when other users interact with the platform:
- **Staking Referrals**: Earn 50 LEXA when referred user stakes
- **Swap Referrals**: Earn 2% in BNB when referred user swaps

This document explains both systems, how they work, how to set them up, and how to track earnings.

## System Architecture

### 1. Frontend - Referral Link Generation
**File**: `app/earn/page.tsx`
- Extracts the authenticated user's wallet address using Privy
- Generates unique referral links for both stake and swap:
  - Stake: `https://lexastake.xyz/stake?ref={walletAddress}`
  - Swap: `https://lexastake.xyz/swap?ref={walletAddress}`
- Users can copy and share both links

### 2. Frontend - Referral Parameter Propagation
**Files**:
- `app/stake/page.tsx` - Extracts `ref` URL parameter for staking
- `app/stake/[tier]/page.tsx` - Passes `ref` through stake flow
- `app/swap/page.tsx` - Extracts `ref` URL parameter for swaps

### 3. Blockchain Integration

#### Staking Referrals
**File**: `services/staking.service.ts`
- Validates the referrer address using `ethers.getAddress()`
- Passes the referrer address to the smart contract stake function
- Falls back to `ZeroAddress` if invalid

#### Swap Referrals
**File**: `services/swap.service.ts` (or custom router service)
- Tracks referral address alongside swap transaction
- Calculates 2% BNB of output amount for reward
- Options for reward distribution:
  1. **Fee-taking Router**: Custom smart contract routes swaps through PancakeSwap and takes 2% cut
  2. **User-paid Fee**: User adds 2% BNB alongside swap amount
  3. **Backend Distribution**: App tracks swap referrals, admin distributes 2% BNB rewards

### 4. Database Tracking
**File**: `services/supabase.service.ts`
- Records referral conversions (both staking and swaps)
- Distinguishes between `type: 'stake'` and `type: 'swap'`
- Calculates total earnings and referral statistics
- Tracks pending vs completed referrals

### 5. API Endpoints
**Files**:
- `app/api/referrals/record/route.ts` - Existing endpoint, extended for swaps
- `app/api/referrals/distribute/route.ts` - (NEW) Distribute 2% BNB to referrers

## Database Schema

### Referrals Table

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referrer_id UUID REFERENCES users(id),
  referrer_address VARCHAR(42),        -- Ethereum wallet
  referred_id UUID REFERENCES users(id),
  referred_address VARCHAR(42),        -- Ethereum wallet
  type VARCHAR(20),                    -- 'stake' or 'swap'
  stake_amount VARCHAR(255),           -- For stake referrals: Amount of LEXA staked
  swap_input_amount VARCHAR(255),      -- For swap referrals: Input amount in BNB spent
  reward_amount VARCHAR(255),          -- Stake: 50 LEXA, Swap: 2% of input BNB
  reward_token VARCHAR(20),            -- 'LEXA' or 'BNB'
  tx_hash VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending', -- pending|completed|failed
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Field Descriptions**:
- `type`: Distinguishes between 'stake' (50 LEXA reward) and 'swap' (2% BNB reward)
- `stake_amount`: Only populated for stake referrals (amount of LEXA staked)
- `swap_input_amount`: Only populated for swap referrals (amount of BNB the user spent)
- `reward_amount`: Fixed 50 LEXA for stakes, calculated as 2% of input BNB for swaps
- `reward_token`: 'LEXA' for stake rewards, 'BNB' for swap rewards

### Secure Earnings Function

Instead of exposing a public materialized view, we use a SECURITY DEFINER function:

```sql
CREATE FUNCTION get_user_referral_earnings(user_address VARCHAR(42))
RETURNS TABLE(...) 
SECURITY DEFINER
```

**Benefits**:
- Users can only query their own earnings
- No data exposure via API
- Function enforces permission checks
- Grants execute to authenticated users only

### Status Values

- **pending**: Referral conversion recorded, waiting for smart contract to process reward
- **completed**: Smart contract has awarded 50 LEXA to referrer
- **failed**: Smart contract failed to award reward (rare)

## Setup Instructions

### 1. Create Supabase Table

Run the SQL in `database_schema.sql` in your Supabase SQL editor:

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL** in the left sidebar
3. Click **New Query**
4. Paste the contents of `database_schema.sql`
5. Click **Run** or press `Cmd+Enter`

This creates:
- `referrals` table
- Indexes for performance
- `referral_earnings_summary` materialized view
- RLS policies

### 2. Verify Environment Variables

Make sure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## User Flow

### Referrer Side

1. User navigates to `/earn` page
2. System detects authenticated user (via Privy)
3. Extracts wallet address from user profile
4. Displays referral link: `https://lexastake.xyz/stake?ref=0x...`
5. User copies and shares link with others

### Referred User Side

1. Referred user clicks the referral link
2. URL parameter `ref=0x...` is preserved through:
   - `/stake?ref=0x...` (tier selection)
   - `/stake/[tier]?ref=0x...` (stake form)
3. User completes staking transaction
4. System automatically records referral in database

### Backend Processing

1. After successful stake transaction:
   - Staking record saved to `staking_history` table
   - If referral detected, calls `/api/referrals/record`
   - Referral record created with `status: 'pending'`
   - Logs: "👥 Recording referral conversion..."

2. When smart contract processes reward:
   - Smart contract transfers 50 LEXA to referrer
   - Backend listens for transfer event and updates referral status to 'completed'
   - (Smart contract integration pending)

## Code Examples

### Generate Referral Link (earn/page.tsx)

```typescript
const { authenticated, user } = usePrivy();

useEffect(() => {
  if (authenticated && user) {
    const walletAddress = extractWalletAddress(user);
    if (walletAddress) {
      const baseUrl = typeof window !== "undefined" 
        ? window.location.origin 
        : "https://lexastake.xyz";
      const link = `${baseUrl}/stake?ref=${walletAddress}`;
      setReferralLink(link);
    }
  }
}, [authenticated, user]);
```

### Pass Referral Through Stake Flow (stake/[tier]/page.tsx)

```typescript
const referralAddress = searchParams.get("ref");

const result = await stakingService.stake(
  {
    amount: amountInWei,
    tier: tierEnum,
    durationDays,
    referrer: referralAddress || undefined,
  },
  signer
);

// Record referral if one exists
if (referralAddress && referralAddress !== walletAddr) {
  const referralResult = await supabaseService.recordReferral(
    referralAddress,
    walletAddr,
    stakeAmount,
    result.hash
  );
}
```

### Get Referral Earnings (supabase.service.ts)

```typescript
const earnings = await supabaseService.getReferralEarnings(walletAddress);
// Returns:
// {
//   referrals: [...],
//   totalEarnings: 250,  // 5 referrals × 50 LEXA
//   totalReferrals: 5,
//   statuses: { pending: 3, completed: 2, failed: 0 }
// }
```

## Swap Referral Flow

### How It Works

When a user performs a swap using another user's referral link, the referrer earns **2% of the BNB input amount**.

Example:
- User B accesses `/swap?ref=0xA...` (with User A's referral link)
- User B swaps 1 BNB → receives 5000 LEXA tokens
- User A receives 0.02 BNB (2% of 1 BNB input) as referral reward
- The 0.02 BNB is 2% of the purchase price (what User B spent), not based on output tokens

### Implementation

**Step 1**: Swap page extracts referral parameter

```typescript
// app/swap/page.tsx
const searchParams = useSearchParams();
const referralAddress = searchParams.get("ref");
```

**Step 2**: On successful swap, calculate and record referral

```typescript
const handleSwap = async (inputAmount, outputAmount) => {
  try {
    // Execute swap on PancakeSwap
    const swapResult = await swapService.executeSwap(inputAmount, outputAmount);
    
    // Calculate 2% BNB reward based on INPUT amount (what user spent)
    const rewardAmount = (parseFloat(inputAmount) * 0.02).toString();
    
    // Record referral conversion
    if (referralAddress && referralAddress !== userAddress) {
      await supabaseService.recordSwapReferral(
        referralAddress,
        userAddress,
        inputAmount,    // Pass input BNB amount, not output
        swapResult.hash
      );
    }
  } catch (error) {
    console.error('Swap failed:', error);
  }
};
```

**Step 3**: Backend records and tracks for distribution

```typescript
// API: POST /api/referrals/record
{
  referrer_address: "0xA...",
  referred_address: "0xB...",
  type: "swap",
  swap_input_amount: "1",       // Input BNB amount user spent
  reward_amount: "0.02",         // 2% of the 1 BNB input = 0.02 BNB
  reward_token: "BNB",
  tx_hash: "0x...",
  status: "pending"
}
```

## Reward Distribution

### Staking Rewards (50 LEXA)

**Distribution Method**: Smart Contract
- Smart contract automatically transfers 50 LEXA when stake is created with referrer
- Status updates to 'completed' when transfer is confirmed
- No manual intervention needed

### Swap Rewards (2% BNB)

**Distribution Methods** (choose one):

#### Option 1: User-Paid Fee (Simplest)
- User adds 2% BNB to swap amount as optional referral fee
- Example: Swapping 1 BNB → User pays 1.02 BNB total
- 0.02 BNB goes directly to referrer address
- Implemented in swap contract/interface

#### Option 2: Fee-Taking Router (Automated)
- Create custom smart contract that wraps PancakeSwap
- Router takes 2% cut from all swaps
- Automatically sends 2% to referrer if swap has referral parameter
- No extra cost to user, comes from output
- More technical but fully automated

#### Option 3: Backend Distribution (Manual/Cron)
- Track all pending swap referrals in database
- Run periodic cron job (e.g., daily) to distribute rewards
- Send 2% BNB to each referrer wallet
- Requires managing treasury wallet with BNB funds
- Simple to implement, requires some manual oversight

#### Option 4: Smart Contract + Oracle (Advanced)
- Create a referral rewards contract
- Swap service calls contract with swap details
- Contract verifies swap amount and sends 2% BNB to referrer
- Most flexible but requires contract deployment and testing

## Smart Contract Integration

### Current State

The referrer address is passed to the smart contract:

```typescript
const tx = await stakingContract.stake(
  amount,
  tier,
  durationDays,
  referrer  // Referrer address (or ZeroAddress if none)
);
```

### Pending Implementation

The smart contract needs to:

1. **Accept referrer parameter** ✅ (Already implemented on contract side)
2. **Award 50 LEXA when stake is created**:
   ```solidity
   if (referrer != address(0)) {
       // Award 50 LEXA to referrer
       IERC20(lexaToken).transfer(referrer, 50e18);
   }
   ```
3. **Emit event for tracking**:
   ```solidity
   event ReferralReward(address indexed referrer, address indexed user, uint256 amount);
   ```

### Listener Service (Pending)

Create a backend service to:
1. Listen for referral reward transfers
2. Update `referrals.status = 'completed'` in database
3. Emit notifications to referrer

## Testing

### Manual Testing

1. **Referrer Setup**:
   - Log in as User A
   - Go to `/earn`
   - Copy referral link: `https://localhost:3000/stake?ref=0xA...`

2. **Referred User**:
   - Log in as User B (different wallet)
   - Use referral link: `https://localhost:3000/stake?ref=0xA...`
   - Complete stake transaction on testnet

3. **Verify Database**:
   - Go to Supabase dashboard
   - Check `referrals` table
   - Should show record with:
     - referrer_address: 0xA...
     - referred_address: 0xB...
     - status: pending

### Automated Testing

```typescript
// Test referral recording
test('should record referral on stake', async () => {
  const referralResult = await supabaseService.recordReferral(
    referrerAddress,
    referredAddress,
    stakeAmount,
    txHash
  );
  expect(referralResult.success).toBe(true);
});

// Test earnings calculation
test('should calculate total earnings correctly', async () => {
  const earnings = await supabaseService.getReferralEarnings(walletAddress);
  expect(earnings.totalEarnings).toEqual(expectedTotal);
});
```

## Troubleshooting

### Referral Not Recorded

**Symptom**: Stake successful, but no referral entry in database

**Possible Causes**:
1. Supabase table doesn't exist - Run `database_schema.sql`
2. API route failing - Check browser console for error
3. Environment variables not set - Verify `.env.local`

**Debug**:
```typescript
// Check console for logs like:
// "👥 Recording referral via API..."
// "✓ Referral recorded successfully"
```

### Self-Referral Blocked

**Symptom**: User tries to stake with their own referral link

**Expected Behavior**:
- API returns `{ success: false, error: "Cannot refer yourself" }`
- Stake still completes successfully (referral just isn't recorded)

### Missing Users

**Symptom**: referrer_id or referred_id is NULL in referrals table

**Expected Behavior**:
- API automatically creates user records if they don't exist
- This shouldn't happen unless database write fails

## Monitoring & Analytics

### Referral Earnings Summary (Secure)

Query the secure function:

```sql
SELECT * FROM get_user_referral_earnings('0x...');
```

Returns (for authenticated user only):
- `total_referrals`: Total referrals made
- `completed_referrals`: Rewards already awarded
- `pending_referrals`: Awaiting smart contract processing
- `total_earned`: Sum of all 50 LEXA amounts
- `earned_completed`: Confirmed earnings
- `earned_pending`: Pending earnings
- `last_referral_date`: Most recent referral timestamp

### Frontend Usage

```typescript
const earnings = await supabaseService.getReferralEarnings(walletAddress);
// Returns earnings object with totals and status breakdown
```

### Admin Analytics (Requires Direct DB Access)

For admin-only analytics queries on total platform referrals:

```sql
-- Total referrals across platform
SELECT COUNT(*) as total_referrals,
       SUM(CAST(reward_amount AS NUMERIC)) as total_rewards
FROM referrals;

-- Referrals by status
SELECT status, COUNT(*) as count
FROM referrals
GROUP BY status;
```

**Note**: These queries require direct database access and should only be run by admins with proper credentials.

## Security Considerations

### Row Level Security (RLS)
- RLS enabled on `referrals` table
- Policies prevent users from viewing other users' referral data
- Separate policies for referrer and referred perspectives
- Addresses normalized to lowercase for consistency

### Secure Earnings Retrieval
- Dedicated SECURITY DEFINER function (`get_user_referral_earnings`)
- Function filters data server-side before returning to client
- Only authenticated users can execute
- Prevents direct table access and data exposure

### API Security
- Insert endpoint validates referrer and referred are different
- Self-referral prevention with validation check
- Automatic user creation prevents missing records
- Transaction hash must be unique (prevents duplicate records)

### Data Validation
- Ethereum addresses validated with `ethers.getAddress()`
- Prevents invalid address formats
- Prevents address checksum mismatches

### Rate Limiting
- No rate limit on referral recording (potential spam)
- **Future**: Add rate limiting to prevent abuse

### Access Control
- Users cannot view other users' referral earnings
- Users cannot modify historical referral records
- API has separate permissions from frontend client

## Future Enhancements

1. **Referral Dashboard**
   - Show all referrals made and earnings
   - Display pending vs completed rewards
   - Social sharing buttons

2. **Leaderboards**
   - Top referrers by number of referrals
   - Top referrers by earnings

3. **Notifications**
   - Email when referral is recorded
   - Email when reward is claimed

4. **Referral Bonuses**
   - Different rewards for different tiers
   - Bonus multiplier for multiple referrals

5. **Database Optimizations**
   - Automatic cleanup of old records
   - Archive completed referrals

6. **Analytics**
   - Referral conversion rates
   - Average reward per referrer
   - Geographic distribution of referrals

## Support

For issues with the referral system:
1. Check browser console for errors
2. Verify Supabase table exists (run SQL schema)
3. Check environment variables are set
4. Review API response in Network tab
5. Contact development team with error details

## Files Modified/Created

### Core Implementation Files
- ✅ `app/earn/page.tsx` - Referral link generation (stake + swap)
- ✅ `app/stake/page.tsx` - Stake referral parameter propagation
- ✅ `app/stake/[tier]/page.tsx` - Referral recording trigger (stake)
- ✅ `services/staking.service.ts` - Smart contract referrer passing
- ✅ `services/supabase.service.ts` - Database methods (enhanced with swap methods)
- ✅ `app/api/referrals/record/route.ts` - API endpoint (extended for swaps)
- ✅ `database_schema.sql` - Database schema (updated for swap support)

### Pending Files
- ⏳ `app/swap/page.tsx` - Needs swap referral parameter extraction
- ⏳ `services/swap.service.ts` - Swap referral recording on completion
- ⏳ `app/api/referrals/distribute/route.ts` - (NEW) 2% BNB distribution endpoint
- ⏳ `services/reward-distributor.service.ts` - (NEW) Handles BNB distribution to referrers

## Next Steps for Swap Referrals

### 1. Update Swap Page to Accept Referral

**File**: `app/swap/page.tsx`

```typescript
'use client';
import { useSearchParams } from 'next/navigation';

export default function SwapPage() {
  const searchParams = useSearchParams();
  const referralAddress = searchParams.get('ref');

  // Use referralAddress in swap logic
  return (
    <div>
      {referralAddress && (
        <div className="bg-blue-100 p-3 rounded">
          Referred by: {referralAddress.slice(0, 6)}...{referralAddress.slice(-4)}
        </div>
      )}
      {/* Swap interface here */}
    </div>
  );
}
```

### 2. Record Swap Referral After Success

**In swap execution handler**:

```typescript
const handleSwapSuccess = async (swapResult: SwapResult, referralAddress?: string) => {
  // Execute swap
  const txHash = swapResult.transactionHash;
  const outputAmount = swapResult.outputAmount;
  
  // Record referral if one exists
  if (referralAddress && referralAddress !== userAddress) {
    const result = await supabaseService.recordSwapReferral(
      referralAddress,      // Who referred
      userAddress,          // Who swapped
      outputAmount,         // BNB output amount
      txHash               // Transaction hash
    );
    
    if (result.success) {
      console.log('✓ Swap referral recorded');
      // Show notification: "Referrer earns 2% = 0.XX BNB"
    } else {
      console.warn('⚠️ Failed to record swap referral');
    }
  }
};
```

### 3. Choose & Implement 2% BNB Distribution

Choose one distribution method:

#### **Option 1: User-Paid Fee (Simplest)**
- User adds checkbox: "Include 2% referral bonus"
- Swap amount increases by 2% (goes to referrer)
- Implementation: Update swap contract call

```typescript
const swapAmount = userInput;
const referralFee = referralAddress ? swapAmount * 0.02 : 0;
const totalAmount = swapAmount + referralFee;
// Send totalAmount to PancakeSwap
// referralFee (separate part) goes to referrer
```

#### **Option 4: Smart Contract Distribution (Recommended)**
- Deploy custom router contract that:
  - Wraps PancakeSwap swap calls
  - Takes 2% of output BNB
  - Sends 2% to referrer address
  - Sends remaining to user

```solidity
// Example pseudocode
function swapWithReferral(
  uint amountIn,
  address[] addressPath,
  address referrer
) external {
  // Swap on PancakeSwap
  uint amountOut = pancakeswap.swap(amountIn, addressPath);
  
  // Calculate 2% referral reward
  uint referralReward = (amountOut * 2) / 100;
  uint userAmount = amountOut - referralReward;
  
  // Transfer amounts
  IWBNB(wbnb).transfer(referrer, referralReward);
  IWBNB(wbnb).transfer(msg.sender, userAmount);
}
```

### 4. Create Distribution Service (for Manual/Cron Methods)

**File**: `app/api/referrals/distribute/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/referrals/distribute
 * Distribute pending 2% BNB rewards to referrers
 * Should be called periodically (e.g., daily via cron job)
 */
export async function POST(request: NextRequest) {
  try {
    // Get API key from header for security
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.REFERRAL_DISTRIBUTION_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all pending swap referrals grouped by referrer
    const { data: pendingRewards, error: queryError } = await supabaseAdmin
      .rpc("get_pending_swap_rewards_for_distribution");

    if (queryError) {
      console.error("Error fetching pending rewards:", queryError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pending rewards" },
        { status: 500 }
      );
    }

    if (!pendingRewards || pendingRewards.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending rewards to distribute",
        distributed: 0,
      });
    }

    // Initialize wallet for distribution
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(
      process.env.REFERRAL_DISTRIBUTOR_PRIVATE_KEY!,
      provider
    );

    let distributedCount = 0;
    const distributionResults = [];

    // Distribute rewards to each referrer
    for (const reward of pendingRewards) {
      try {
        const rewardBnb = ethers.parseEther(reward.total_pending_amount.toString());

        // Send BNB to referrer
        const tx = await wallet.sendTransaction({
          to: reward.referrer_address,
          value: rewardBnb,
        });

        // Wait for confirmation
        await tx.wait();

        // Update referrals status to completed
        await supabaseAdmin
          .from("referrals")
          .update({ status: "completed" })
          .eq("referrer_address", reward.referrer_address)
          .eq("type", "swap")
          .eq("status", "pending");

        distributionResults.push({
          referrer: reward.referrer_address,
          amount: reward.total_pending_amount,
          txHash: tx.hash,
          status: "success",
        });

        distributedCount++;
      } catch (error) {
        console.error(`Failed to distribute to ${reward.referrer_address}:`, error);
        distributionResults.push({
          referrer: reward.referrer_address,
          amount: reward.total_pending_amount,
          status: "failed",
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      distributed: distributedCount,
      total: pendingRewards.length,
      results: distributionResults,
    });
  } catch (error) {
    console.error("Error in distribution API:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

### 5. Set Up Cron Job (Optional, for Manual Distribution)

**Using Vercel Cron Functions** (add to `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/referrals/distribute",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Or using external service** (e.g., GitHub Actions, AWS Lambda):

```yaml
# .github/workflows/distribute-referral-rewards.yml
name: Distribute Referral Rewards
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  distribute:
    runs-on: ubuntu-latest
    steps:
      - name: Distribute rewards
        run: |
          curl -X POST https://lexastake.xyz/api/referrals/distribute \
            -H "Authorization: Bearer ${{ secrets.REFERRAL_DISTRIBUTION_SECRET }}" \
            -H "Content-Type: application/json"
```

## Summary

The swap referral system is now:
- ✅ Tracked in database (2% BNB amount calculated and stored)
- ✅ Securely stored with type distinction ('swap' vs 'stake')
- ✅ Queryable via `getSwapReferralEarnings()` function
- ⏳ Awaiting distribution implementation (choose your method above)
- ⏳ Awaiting swap page integration

Pick your preferred distribution method and implement the remaining pieces!

