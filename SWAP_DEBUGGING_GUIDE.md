# 🔧 Swap Debugging Guide

## Overview

The swap transaction hook has been completely rewritten with **detailed console logging at every step**. If the wallet is silently cancelling transactions, the console logs will now show exactly where it's failing.

## What Changed

### Before
- Scattered error handling
- Missing console logs between steps
- Complex nested try-catch blocks
- Difficult to trace where failures occur

### After  
- **Clear section markers** with visual separators
- **Console logging at EVERY step** (Step 1-5)
- **Cleaner error messages** with helpful suggestions
- **Better error context** distinguishing between user rejection vs technical failure
- **Simplified flow** - easier to follow

---

## Console Debugging: The 5 Steps

When you attempt a swap, open DevTools and watch for these sections in the console:

### 📋 Step 1: Preparing Swap Transaction
```
==================================================
STEP 1: Preparing swap transaction...
==================================================
```
**What it does**: Calls backend API to calculate quote and build transaction data
**If it fails here**: Backend issue - check network request in Network tab
**Console log to look for**: ❌ API error response

---

### 📋 Step 2: Getting Signer
```
==================================================
STEP 2: Getting provider and signer from Privy...
==================================================
```
**What it does**: Connects to wallet via ethers.js + Privy
**If it fails here**: Wallet connection issue, Privy not initialized
**Console log to look for**: 
- ✓ BrowserProvider created
- ✓ Signer obtained successfully
- ❌ SIGNER ERROR

---

### 📋 Step 3: Verifying Network
```
==================================================
STEP 3: Verifying network (BSC Mainnet)...
==================================================
```
**What it does**: Checks that wallet is on BSC MainNet (ChainId 56)
**If it fails here**: Wallet is on wrong network
**Console log to look for**:
- 🌐 Network check: binance (ChainId: 56n) ✓
- ❌ Wrong network! You're on... Please switch in your wallet

**HOW TO FIX**: Manually switch network in wallet to BSC MainNet

---

### 📋 Step 4: Requesting Approval (If Needed)
```
==================================================
STEP 4: Requesting token approval...
==================================================
```
**What it does**: Asks wallet permission to spend your token
**Only happens for**: LEXA → BNB or Token → Token swaps
**NOT needed for**: BNB → LEXA swaps (BNB is native)
**Console log to look for**:
- 🔐 Sending approval to wallet - PLEASE CONFIRM IN YOUR WALLET
- ✓ Approval confirmed. Hash: 0x...
- ❌ Approval error

---

### 📋 Step 5: Executing Swap
```
==================================================
STEP 5: Executing swap transaction...
==================================================
```
**What it does**: Sends the actual swap transaction to PancakeSwap Router
**Console log to look for**:
- 🔐 Sending swap to wallet - PLEASE CONFIRM IN YOUR WALLET
- ✓ Swap sent, TX hash: 0x...
- ✓✓ SWAP SUCCESSFUL! TX Hash: 0x...

---

## Common Error Scenarios

### ❌ "User rejected the swap transaction"
**Cause**: You clicked "Reject" in the wallet confirmation dialog
**Solution**: Approve the transaction by clicking "Confirm"
**Console shows**: At Step 4 or 5, includes "user rejected"

### ❌ "Wrong network! You're on..."
**Cause**: Wallet is set to a network other than BSC
**Solution**: 
1. Open wallet
2. Click network selector
3. Choose "Binance Smart Chain" (ChainId 56)
4. Try swap again
**Console shows**: Step 3, network check fails

### ❌ "You rejected the approval request"
**Cause**: Clicked "Reject" on approval dialog
**Solution**: Must approve for token swaps. Approval is safe (limited to router address)
**Console shows**: During Step 4
**Technical detail**: Only needed when selling LEXA, not when selling BNB

### ❌ "Insufficient liquidity or balance"
**Cause**: Not enough tokens in PancakeSwap pool or your account
**Solution**:
- Check balance is > swap amount
- Try reducing swap amount
- Check PancakeSwap has liquidity for this pair
**Console shows**: Step 5, includes "insufficient"

### ❌ "Swap failed - try increasing slippage"
**Cause**: Price moved too much during transaction confirmation
**Solution**: 
1. Increase slippage in Settings (try 5% or 10%)
2. Reduce swap amount
3. Try again quickly
**Console shows**: Step 5, includes "reverted"

### ❌ "Transaction is pending - check your wallet"
**Cause**: Confirmation took longer than 2 minutes
**Solution**: 
- Check your wallet for pending transactions
- Wait for it to confirm
- Or speed it up / cancel and retry
**Console shows**: Step 5, includes "timeout"

### ❌ "You're on Arc testnet and it is not switching"
**Root cause**: Issue from earlier - now FIXED
**What was wrong**: Code was using `window.ethereum` directly instead of Privy wallet provider
**What changed**: Now uses proper Privy integration + explicit network verification
**Console shows**: Step 3 - network verification now works correctly
**Solution**: No action needed - code is fixed

---

## How to Debug in Browser DevTools

### 1. Open Console
- **Chrome/Edge**: `F12` or `Ctrl+Shift+J`
- **Firefox**: `F12` or `Ctrl+Shift+K` 
- **Safari**: `Cmd+Option+I`

### 2. Filter for Swap Logs
Type this in the console:
```javascript
// Show only swap-related logs
console.clear()
// Then try the swap again
```

Or search by typing in the filter:
- Search for: `🚀 [SWAP]` to find all swap events
- Search for: `❌` to find all errors
- Search for: `STEP` to find step markers

### 3. Check Each Step
Working swap will show:
```
🚀 [SWAP] ========== SWAP EXECUTION START ==========
==================================================
STEP 1: Preparing swap transaction...
==================================================
✓ Swap prepared successfully
==================================================
STEP 2: Getting provider and signer...
==================================================
✓ BrowserProvider created
✓ Signer obtained successfully
==================================================
STEP 3: Verifying network...
==================================================
✓ Correct network (BSC MainNet)
==================================================
STEP 4: Requesting token approval...
==================================================
(only if not BNB input)
==================================================
STEP 5: Executing swap transaction...
==================================================
✓ Swap sent, TX hash: 0x123...
⏳ Waiting for swap confirmation...
✓✓ SWAP SUCCESSFUL!
```

### 4. Network Tab Debugging
If Step 1 fails:
1. Open DevTools → Network tab
2. Try swap again
3. Look for request to `/api/pancakeswap/prepare-swap`
4. Click on it → Response tab
5. Check the JSON response for errors

---

## Wallet-Level Debugging

### MetaMask
1. Press the MetaMask extension
2. Click the three dots (⋯)
3. Select "Connected sites"
4. Check that your domain is listed as "Connected"
5. Try swap again

### Privy Wallet
1. Check Privy console in DevTools  
2. Look for "Wallet connected" message
3. Verify wallet address is shown on page
4. If not connected, click "Connect Wallet" button first

---

## Network Request Debugging

### Check Backend API
In DevTools Network tab:
```
POST /api/pancakeswap/prepare-swap
```

**Response should look like**:
```json
{
  "swap": {
    "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "data": "0x...",
    "value": "0"
  },
  "approval": {
    "to": "0x...",  // token address
    "data": "0x..."
  },
  "details": {
    "amountIn": "1.0",
    "amountOut": "...",
    "minimumAmountOut": "...",
    "deadline": 1234567890
  }
}
```

**If you see an error instead**:
- Note the error message
- Check that `tokenIn` and `tokenOut` are valid addresses
- Check that `amountIn` is a valid number

---

## Advanced Debugging

### Log Full Transaction Object
In console after swap attempt, paste:
```javascript
// Copy this and paste in console DevTools
localStorage.getItem('lastSwapTx')
```

### Check Gas Prices
```javascript
// Check if provider can see gas prices
// This happens in Step 5 automatically
```

### Simulate Transaction (Advanced)
In MetaMask:
1. Go to Settings → Developer
2. Turn on "Advanced" 
3. Try swap - it will show estimated gas before confirmation

---

## Report a Bug

If swap still fails after checking all this:

1. **Clear console** (`console.clear()`)
2. **Try swap again**
3. **Copy all console output**
4. **Take screenshot** of:
   - DevTools console showing error
   - Your wallet state (which chain, balance)
5. **Report with**:
   - Error message from console
   - Which step failed (1-5)
   - What you were trying to swap (BNB → LEXA? LEXA → BNB?)
   - Which wallet you're using (MetaMask, Privy, etc.)
   - Network (BSC MainNet only)

---

## Success Indicators

✅ **Swap is working when you see**:
- ✓ Swap sent, TX hash: `0x...` in console
- Transaction hash appears in MetaMask activity
- Network explorer shows transaction
- Balances update in wallet
- Console shows: `✓✓ SWAP SUCCESSFUL!`

---

## Quick Checklist

Before reporting issues, verify:
- [ ] Wallet is connected (green button shows address)
- [ ] Network is BSC MainNet (not testnet, not other chain)
- [ ] Have sufficient balance for swap + gas
- [ ] Token addresses are correct (LEXA, BNB)
- [ ] No MetaMask nonce errors
- [ ] Browser has no extensions blocking

---

## Code Changes Made

### Updated `useSwap.ts` Hook
- **Lines in Swap Execution function**: Completely rewritten
- **New logging**: 5 clear sections with markers
- **Error handling**: Separated user rejection from technical errors
- **Network verification**: Explicit check in Step 3
- **Simplified**: Removed duplicate API calls

### Files Modified
- `hooks/useSwap.ts` - ✅ Updated with new logging

### No breaking changes
- Hook API is same
- All parameters work same way
- Component integration unchanged

---

**Last Updated**: February 10, 2026  
**Status**: Production Ready with Enhanced Debugging
