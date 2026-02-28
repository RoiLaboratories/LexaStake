# Frontend Staking Integration Guide

## Overview

The frontend is now fully integrated with the LexaStaking smart contract. Here's how the staking flow works:

## Architecture

### Services Layer

#### 1. **blockchainService** (`services/blockchain.service.ts`)
- Reads blockchain state (no wallet needed)
- **Methods:**
  - `getLexaAndBNBBalances(walletAddress)` - Fetches LEXA and BNB balances
  - Works with public RPC endpoints (no signer required)

#### 2. **stakingService** (NEW - `services/staking.service.ts`)
- Executes transactions on the staking contract
- Requires wallet signer from Privy
- **Methods:**
  - `approve(amount, wallet)` - Approve LEXA spending
  - `stake(params, wallet)` - Create a new stake
  - `claimRewards(stakeIndex, wallet)` - Claim rewards
  - `unstake(stakeIndex, wallet)` - Unstake tokens
  - `getAccumulatedRewards(userAddress, stakeIndex)` - View accumulated rewards

### Authentication Layer

- **Privy Integration** - Handles wallet connection
- Uses embedded wallet for transaction signing
- Automatically retrieves signer via `embeddedWallet.getEthersProvider()`

## Staking Flow

```
1. User connects wallet via Privy
2. Balance fetches from blockchain (read-only)
3. User enters stake amount, duration, and tier
4. On "Stake Now" button click:
   a. Validate inputs (amount, minimum stake, balance)
   b. Convert amount to wei (18 decimals)
   c. Get wallet signer from Privy
   d. Call stakingService.approve() to allow contract spending
   e. Call stakingService.stake() with tier, duration, amount
   f. Wait for transaction confirmation
   g. On success: Show success message, reset form, refetch balance
   h. On error: Show error message with reason
```

## Updated Files

### 1. **services/staking.service.ts** (NEW)
Complete smart contract integration with:
- LEXA token approval logic
- Stake creation with tier selection
- Reward claiming
- Unstaking

### 2. **app/stake/[tier]/page.tsx** (UPDATED)
- Imported `stakingService` and `StakingTier` enum
- Replaced mock `handleStake()` with real contract call
- Added error handling and validation
- Integrated with Privy wallet signer

### 3. **.env** (UPDATED)
Added frontend environment variables:
```env
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed1.binance.org
NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=0x02BC1b3F3A4655a5273b914c37ED4388DEaC58FE
```

## Configuration

### Update Contract Address (Required)

If you deploy a new staking contract, update `.env`:

```env
NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=0x<your_new_contract_address>
```

Or update in `services/staking.service.ts` line 101:
```typescript
private readonly STAKING_CONTRACT_ADDRESS = 
  process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS ||
  "0x02BC1b3F3A4655a5273b914c37ED4388DEaC58FE";
```

### Update RPC Endpoint

Default: `https://bsc-dataseed1.binance.org`

Update in `.env`:
```env
NEXT_PUBLIC_BSC_RPC_URL=https://your_preferred_rpc_url
```

## User Flow

### 1. **Connect Wallet**
- Privy handles wallet connection
- Button in header: `StakeHeader` component

### 2. **View Staking Tiers**
- Navigate to `/stake`
- Shows Bronze, Silver, Gold tiers
- Click on tier to proceed

### 3. **Enter Stake Details**
- Amount in LEXA tokens
- Duration (90 or 180 days)
- View ROI based on tier and duration
- "Max" button to stake entire balance
- Form validation prevents invalid stakes

### 4. **Approve & Stake**
Click "Stake Now":
```
✓ Validates inputs
✓ Checks balance
✓ Gets wallet signer from Privy
✓ Approves LEXA spending (if needed)
✓ Submits stake transaction
✓ Waits for confirmation
✓ Shows success/error notification
✓ Refetches balance on success
```

### 5. **Transaction Notifications**
- **Loading** - Transaction pending
- **Success** - Shows staked amount, tier, ROI
- **Error** - Shows specific error reason

## Error Handling

The staking flow includes comprehensive error handling:

```typescript
// Possible errors:
"Please enter a valid stake amount"
"Insufficient LEXA balance"
"Minimum stake is $X LEXA"
"Wallet not connected"
"Transaction failed"
// + Specific contract revert reasons
```

## Testing Locally

### Prerequisites
1. Staking contract deployed to BSC
2. `.env` configured with contract address
3. LEXA token approved for testing

### Test Steps
1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/stake`
3. Connect wallet via Privy
4. Select a tier
5. Enter stake amount
6. Click "Stake Now"
7. Confirm wallet transaction
8. Verify on BscScan

## Contract Interactions

### StakingTier Enum
```typescript
enum StakingTier {
  BRONZE = 0,  // $10 min, 5-10% ROI
  SILVER = 1,  // $20 min, 10-25% ROI
  GOLD = 2     // $50 min, 15-35% ROI
}
```

### Stake Parameters
```typescript
interface StakeParams {
  amount: bigint;          // Amount in wei (18 decimals)
  tier: StakingTier;       // Tier enum (0, 1, or 2)
  durationDays: number;    // 90 or 180
  referrer?: string;       // Optional referrer address
}
```

## Future Enhancements

### TODO
- [ ] Add ability to view active stakes
- [ ] Implement claim rewards UI
- [ ] Add unstake functionality
- [ ] Referral link sharing
- [ ] Transaction history
- [ ] APY calculator
- [ ] Multi-chain support
- [ ] Ledger/Hardware wallet support

## Security Notes

⚠️ **Frontend Deployment**
- All contract addresses in `.env` are public (NEXT_PUBLIC prefix)
- Never put private keys in frontend environment variables
- Always verify contract addresses before deployment
- Use hardware wallet for mainnet deployments

⚠️ **Wallet Security**
- Privy handles private key management
- Users always confirm transactions in their wallet
- No private keys exposed to frontend code

## Troubleshooting

### Transaction Fails with "User rejected"
- User cancelled transaction in wallet
- No action needed, can retry

### "Wallet not connected"
- User not authenticated with Privy
- Click connect button in header

### "Insufficient LEXA balance"
- Wallet has less LEXA than stake amount
- Recommend user to acquire more LEXA

### "Contract address invalid"
- Check `NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS` in .env
- Verify contract is deployed to correct network
- Check contract on BscScan

### Approval transaction fails
- Contract address incorrect
- User cancelled transaction
- Gas estimate too low

## Resources

- [LexaStaking Contract](../contracts/staking/LexaStaking.sol)
- [Privy Documentation](https://docs.privy.io)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [BscScan](https://bscscan.com)
