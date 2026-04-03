# SwapReferralRewards Contract - Setup & Troubleshooting Guide

## Overview
The SwapReferralRewards contract sends 2% BNB rewards to referrers after swaps. The error you encountered indicates the contract isn't properly funded or configured.

---

## Issues & Solutions

### Issue 1: "Insufficient balance" Error ❌

**Problem:** Contract doesn't have enough BNB to send rewards.

**Solution:** Fund the contract with BNB

```bash
# Fund with 0.1 BNB (default)
npx ts-node scripts/fundSwapRewardsContract.ts

# Or specify custom amount
npx ts-node scripts/fundSwapRewardsContract.ts 0.5
```

**What this does:**
- Sends BNB from your owner wallet to the SwapReferralRewards contract
- Verifies the transaction on-chain
- Shows before/after balance

---

### Issue 2: "execution reverted (unknown custom error)" ❌

**Problem:** Contract is reverting but the error message isn't clear.

**Likely causes:**
1. **Missing Private Key** - `REFERRAL_DISTRIBUTOR_PRIVATE_KEY` not set ✅ (FIXED)
2. **Wrong Owner Address** - Signer isn't the contract owner
3. **Insufficient Contract Balance** - See Issue 1 above
4. **Invalid Addresses** - Referrer or swapper address is 0x0 or invalid

**Solution:** Check your `.env.local` has:
```env
# Owner Private Key (required for sending rewards)
REFERRAL_DISTRIBUTOR_PRIVATE_KEY=<your-private-key-here>

# Contract Address
NEXT_PUBLIC_SWAP_REWARDS_CONTRACT=0x69867Bab16B2261A6866c9c6eD02A21A94C54657
```

---

### Issue 3: Verify Contract Status

Check contract balance and configuration:

```bash
# Check contract balance
cast balance 0x69867Bab16B2261A6866c9c6eD02A21A94C54657 --rpc-url $RPC_URL

# Or using Node.js
node -e "
const ethers = require('ethers');
const rpc = 'https://rpc.ankr.com/bsc/288a91e95e5be92ccab6be7ffb340161e68b02a1294267c6de068d47e53f4ff8';
const provider = new ethers.JsonRpcProvider(rpc);
provider.getBalance('0x69867Bab16B2261A6866c9c6eD02A21A94C54657')
  .then(b => console.log('Balance:', ethers.formatEther(b), 'BNB'));
"
```

---

## Contract Details

| Property | Value |
|----------|-------|
| **Network** | BSC Mainnet (Chain ID: 56) |
| **Contract Address** | `0x69867Bab16B2261A6866c9c6eD02A21A94C54657` |
| **Owner Address** | `0xe71dD45E7d21409b04b609D0E6C67FFff592d43d` |
| **RPC URL** | `https://rpc.ankr.com/bsc/...` |

---

## How Rewards Flow

```
1. User completes swap via PancakeSwap
   ↓
2. Frontend calculates 2% reward (e.g., 0.02 BNB from 1 BNB swap)
   ↓
3. Frontend calls POST /api/rewards/send
   ↓
4. Backend signs transaction with owner private key
   ↓
5. Contract's sendReward() function executes:
   - Validates referrer & swapper addresses
   - Checks contract has sufficient BNB balance
   - Sends BNB to referrer
   - Emits RewardSent event
   ↓
6. Frontend receives confirmation & logs success
```

---

## Debugging Steps

### Step 1: Verify Configuration
```bash
# Check environment variables are loaded
grep -E "REFERRAL_DISTRIBUTOR|SWAP_REWARDS" .env.local
```

### Step 2: Check Contract Balance
```bash
# Look at funding script output to see current balance
npx ts-node scripts/fundSwapRewardsContract.ts 0
```

### Step 3: Check Owner Private Key
```bash
# Verify private key is valid (32 bytes hex)
node -e "
const key = process.env.REFERRAL_DISTRIBUTOR_PRIVATE_KEY || '';
console.log('Key length:', key.length);
console.log('Is valid hex:', /^[0-9a-f]{64}$/i.test(key));
console.log('Derived from:', require('ethers').Wallet.fromPrivateKey('0x' + key).address);
" 
```

### Step 4: Check API Response
When sending rewards, monitor the API response:
- Status `400` = Configuration/validation error (check logs)
- Status `500` = Contract execution error (usually balance)

---

## Quick Checklist ✅

- [ ] `REFERRAL_DISTRIBUTOR_PRIVATE_KEY` is in `.env.local`
- [ ] Contract has BNB balance (run funding script)
- [ ] Correct contract address: `0x69867Bab16B2261A6866c9c6eD02A21A94C54657`
- [ ] Owner wallet matches deployment
- [ ] RPC URL is accessible

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Insufficient balance` | Contract BNB balance < reward amount | Fund contract |
| `Invalid referrer address` | Referrer is 0x0 or invalid format | Check addresses in request |
| `Referrer cannot be swapper` | Same address used for both | Use different addresses |
| `Transfer failed` | Contract can't send BNB to recipient | Check recipient address |
| `Configuration error: Owner private key not configured` | Missing env var | Add private key to .env.local |

---

## Next Steps

1. **Environment Variable** ✅ Added `REFERRAL_DISTRIBUTOR_PRIVATE_KEY`
2. **Fund Contract** → Run `npx ts-node scripts/fundSwapRewardsContract.ts 0.1`
3. **Test Reward** → Complete a swap and monitor console
4. **Monitor Logs** → Check server logs for detailed error info

For detailed server logs, add this to your .env.local:
```env
LOG_LEVEL=debug
