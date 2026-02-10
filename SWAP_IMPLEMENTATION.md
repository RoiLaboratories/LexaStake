# DEX Swap Implementation Guide

Complete implementation of token swap functionality for LexaStake DEX using Privy, PancakeSwap Router V2, and ethers.js.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Components](#components)
4. [Integration Examples](#integration-examples)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      React Components                    │
│                    (swap/page.tsx)                       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    useSwapEnhanced Hook                  │
│        (State management + quote fetching)               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Swap Utility Functions                  │
│  swapUtils.ts (Low-level swap operations)               │
│  - Balance checks                                        │
│  - Quote calculations                                    │
│  - Approvals                                             │
│  - Swap execution                                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│         Privy + ethers.js + Window.Ethereum             │
│     (Wallet connection & blockchain interaction)        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│       PancakeSwap Router V2 on BSC Mainnet              │
│  (0x10ED43C718714eb63d5aA57B78B54704E256024E)          │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### **swapUtils.ts** - Low-Level Utilities
Contains core swap logic:
- Balance fetching
- Token allowance checks & approvals
- Quote calculations
- Swap execution functions
- Error classes for proper error handling

#### **useSwapEnhanced.ts** - React Hook
High-level hook for managing swap state:
- Sell/receive token selection
- Amount input management
- Quote auto-fetching with debouncing
- Price fetching
- Swap execution orchestration
- Error messaging

#### **API Routes** (app/api/pancakeswap/)
Backend services for quote generation:
- `/quote` - Get swap amounts via on-chain reads
- `/prepare-swap` - Build encoded transaction
- `/wallet/balance` - Fetch token balances

---

## Quick Start

### 1. Installation

The utilities are already set up. Just need to import and use:

```typescript
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";
```

### 2. Basic Usage in a Component

```typescript
"use client";
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";

export default function SwapPage() {
  const {
    sellToken,
    receiveToken,
    sellAmount,
    receiveAmount,
    balance,
    quote,
    isLoadingQuote,
    errorMessage,
    transactionStatus,
    swapTokens,
    handleMaxAmount,
    executeSwap,
  } = useSwapEnhanced();

  return (
    <div>
      {/* Sell Token Input */}
      <input
        type="number"
        value={sellAmount}
        onChange={(e) => setSellAmount(e.target.value)}
        placeholder={`Enter ${sellToken.symbol} amount`}
      />

      {/* Swap Button */}
      <button
        onClick={executeSwap}
        disabled={
          transactionStatus === "loading" ||
          !sellAmount ||
          parseFloat(sellAmount) > parseFloat(balance)
        }
      >
        {transactionStatus === "loading" ? "Swapping..." : "Swap"}
      </button>

      {/* Error Display */}
      {errorMessage && (
        <div className="error">{errorMessage}</div>
      )}
    </div>
  );
}
```

---

## Components

### Swap Utilities (swapUtils.ts)

#### Balance Functions

```typescript
// Get single token balance
const balance = await getTokenBalance(provider, tokenAddress, walletAddress);

// Get multiple balances at once
const balances = await getMultipleBalances(
  provider,
  walletAddress,
  [tokenAddress1, tokenAddress2]
);

// Get BNB + LEXA balances
const { bnb, lexa } = await getUserBalances(provider, walletAddress);
```

#### Approval Functions

```typescript
// Check current allowance
const allowance = await getAllowance(
  provider,
  tokenAddress,
  ownerAddress,
  spenderAddress
);

// Request approval
const { hash, receipt } = await approveToken(
  signer,
  tokenAddress,
  amountInEther,
  spenderAddress
);
```

#### Quote Functions

```typescript
// Get swap quote (amounts and exchange rate)
const quote = await getSwapQuote(
  provider,
  amountIn,  // e.g., "100" (in ether format, not wei)
  tokenIn,   // token address
  tokenOut   // token address
);
// Returns: { path, amountIn, amountOut, exchangeRate }

// Calculate minimum output with slippage
const minOutput = calculateMinimumOutput(
  amountOut,    // e.g., "50"
  slippagePercent  // e.g., "0.5" for 0.5%
);
```

#### Swap Execution

```typescript
// Execute token-to-token swap (use for LEXA ↔ LEXA swaps)
const result = await executeTokenSwap(
  signer,
  amountIn,        // "100"
  amountOutMin,    // "49.5"
  path,            // [tokenIn, WBNB?, tokenOut]
  recipientAddress,
  deadline         // unix timestamp (default: now + 20min)
);

// Execute BNB → token swap (no approval needed)
const result = await executeBNBToTokenSwap(
  signer,
  amountInBNB,     // "1.5"
  amountOutMin,    // "49500"
  tokenOut,
  recipientAddress
);

// Execute token → BNB swap
const result = await executeTokenToBNBSwap(
  signer,
  amountIn,        // "100000"
  amountOutMin,    // "1.4"
  tokenIn,
  recipientAddress
);

// High-level unified function (handles everything)
const result = await executeSwap(
  signer,
  provider,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  slippagePercent,
  recipientAddress
);
```

### React Hook (useSwapEnhanced)

```typescript
const {
  // Tokens
  sellToken,
  receiveToken,
  setSellToken,
  setReceiveToken,

  // Amounts
  sellAmount,
  receiveAmount,
  setSellAmount,
  setReceiveAmount,

  // Slippage
  slippage,
  customSlippage,
  setSlippage,
  setCustomSlippage,
  slippageOptions,

  // State
  quote,                    // Swap quote object
  transactionStatus,        // "idle" | "loading" | "success" | "error"
  errorMessage,             // Error message string
  isLoadingQuote,           // Boolean
  balance,                  // Available balance of sell token
  prices,                   // { bnb: number, lexa: number }
  loadingMessage,           // Current operation (e.g., "Executing swap...")

  // Functions
  swapTokens,              // Swap sell/receive tokens
  handleMaxAmount,         // Set to maximum balance
  handlePercentage,        // Set to percentage (0-1) of balance
  executeSwap,             // Execute the swap
  resetTransaction,        // Reset status after success/error
  updateBalance,           // Manually refresh balance

  // Status
  isAuthenticated,         // Boolean
  walletAddress,           // User's wallet address
} = useSwapEnhanced();
```

---

## Integration Examples

### Example 1: Basic Swap Form

```typescript
"use client";
import { useState } from "react";
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";
import { TOKENS } from "@/constants/tokens";

export default function SwapForm() {
  const {
    sellToken,
    receiveToken,
    sellAmount,
    receiveAmount,
    balance,
    quote,
    isLoadingQuote,
    errorMessage,
    transactionStatus,
    slippage,
    setSellAmount,
    setSlippage,
    handleMaxAmount,
    swapTokens,
    executeSwap,
    resetTransaction,
  } = useSwapEnhanced();

  return (
    <div className="card p-6 max-w-md">
      <h2 className="text-2xl font-bold mb-4">Swap Tokens</h2>

      {/* Sell Token Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          You're selling ({sellToken.symbol})
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={handleMaxAmount}
            className="px-3 py-2 bg-blue-500 text-white rounded"
          >
            Max
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Balance: {balance} {sellToken.symbol}
        </p>
      </div>

      {/* Swap Direction Button */}
      <button
        onClick={swapTokens}
        className="w-full py-2 mb-4 bg-gray-200 rounded"
      >
        ⇅
      </button>

      {/* Receive Token Display */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          You're receiving ({receiveToken.symbol})
        </label>
        <div className="px-3 py-2 border rounded bg-gray-50">
          {isLoadingQuote ? "Loading..." : receiveAmount || "0.00"}
        </div>
      </div>

      {/* Quote Information */}
      {quote && !isLoadingQuote && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
          <div className="flex justify-between">
            <span>Exchange Rate:</span>
            <span>{quote.exchangeRate}</span>
          </div>
          <div className="flex justify-between">
            <span>Minimum Received:</span>
            <span>{quote.minimumReceived} {receiveToken.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee:</span>
            <span>{quote.fee}%</span>
          </div>
        </div>
      )}

      {/* Slippage Setting */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Slippage: {slippage}%</label>
        <select
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="0.5">0.5%</option>
          <option value="1">1%</option>
          <option value="5">5%</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Error Display */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={executeSwap}
        disabled={
          transactionStatus === "loading" ||
          !sellAmount ||
          parseFloat(sellAmount) > parseFloat(balance)
        }
        className={`w-full py-2 rounded font-semibold ${
          transactionStatus === "loading"
            ? "bg-gray-400 text-white cursor-not-allowed"
            : parseFloat(sellAmount) > parseFloat(balance)
              ? "bg-red-300 text-white cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {transactionStatus === "loading"
          ? `${transactionStatus === "loading" ? "Processing..." : "Swap"}`
          : "Swap"}
      </button>

      {/* Success Message */}
      {transactionStatus === "success" && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded">
          ✓ Swap successful! Transaction confirmed.
          <button
            onClick={resetTransaction}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Using Utilities Directly

```typescript
import {
  getTokenBalance,
  getSwapQuote,
  approveToken,
  executeSwap,
} from "@/utils/swapUtils";
import { BrowserProvider } from "ethers";

async function performSwap(amount: string) {
  // Get provider and signer
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Check balance
  const balance = await getTokenBalance(provider, LEXA_ADDRESS, userAddress);
  if (parseFloat(balance) < parseFloat(amount)) {
    throw new Error("Insufficient LEXA balance");
  }

  // Get quote
  const quote = await getSwapQuote(
    provider,
    amount,
    LEXA_ADDRESS,
    WBNB_ADDRESS
  );

  // Approve token (if needed)
  await approveToken(signer, LEXA_ADDRESS, amount);

  // Execute swap
  const result = await executeSwap(
    signer,
    provider,
    LEXA_ADDRESS,
    WBNB_ADDRESS,
    amount,
    quote.amountOut,
    "0.5",  // 0.5% slippage
    userAddress
  );

  return result;
}
```

---

## Error Handling

The implementation includes custom error classes for granular error handling:

```typescript
import {
  SwapError,
  InsufficientBalanceError,
  ApprovalError,
  SwapExecutionError,
} from "@/utils/swapUtils";

try {
  await executeSwap(...);
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.error("Not enough balance:", error.details);
  } else if (error instanceof ApprovalError) {
    console.error("Approval failed:", error.message);
  } else if (error instanceof SwapExecutionError) {
    console.error("Swap failed:", error.message);
  } else if (error instanceof SwapError) {
    console.error("Generic swap error:", error.code, error.details);
  }
}
```

### Error Messages to User

```typescript
// Hook automatically converts technical errors to user-friendly messages:

"Please enter an amount to swap"
"Please connect your wallet"
"Insufficient BNB balance. You have 0.5, need 1"
"You rejected the approval. Please approve to continue."
"You rejected the swap transaction"
"Swap would fail - insufficient output or liquidity. Try increasing slippage."
"Please switch to BSC mainnet"
```

---

## Best Practices

### 1. Always Check Balance Before Swap

```typescript
if (parseFloat(sellAmount) > parseFloat(balance)) {
  setErrorMessage(`Insufficient balance`);
  return;
}
```

### 2. Use Debounced Quote Fetching

The hook already implements this, but if using utils directly:

```typescript
const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

useEffect(() => {
  if (timeoutId) clearTimeout(timeoutId);
  
  const id = setTimeout(async () => {
    const quote = await getSwapQuote(...);
    setQuote(quote);
  }, 800); // Wait 800ms after user stops typing
  
  setTimeoutId(id);
}, [sellAmount]);
```

### 3. Verify Network Before Swap

```typescript
import { verifyBSCNetwork } from "@/utils/swapUtils";

const provider = new BrowserProvider(window.ethereum!);
await verifyBSCNetwork(provider); // Throws if not on BSC
```

### 4. Handle Approval Edge Cases

```typescript
// Check allowance before requesting approval
const allowance = await getAllowance(provider, tokenAddress, userAddress);

if (parseFloat(allowance) < parseFloat(amountNeeded)) {
  // Request approval for exact amount or higher (unlimited approval)
  await approveToken(signer, tokenAddress, amountNeeded);
}
```

### 5. Set Adequate Slippage for LEXA

LEXA has a 5% transfer tax, so minimum slippage should be 5-10%:

```typescript
const slippageOptions = ["5", "6", "7", "10", "15", "20"];
const defaultSlippage = "15"; // Account for 5% tax + volatility + fees
```

### 6. Handle Transaction Confirmation Properly

```typescript
const result = await executeTokenSwap(...);

// Wait for confirmation if needed
if (result.receipt) {
  if (result.receipt.status === 0) {
    throw new Error("Transaction reverted");
  }
  console.log("Confirmed in block:", result.receipt.blockNumber);
}
```

---

## Key Features Implemented

✅ **Privy Integration**
- Connect wallet via Privy (supports MetaMask, WalletConnect, more)
- Get signer for transaction signing
- Auto-detect wallet address

✅ **PancakeSwap Router V2**
- Direct LEXA ↔ BNB swaps
- Automatic routing via WBNB
- Quote fetching on-chain
- Gas-efficient swap execution

✅ **Complete Swap Flow**
- Balance checking
- Token approval (with allowance checking)
- Slippage calculation
- Transaction building & signing
- Confirmation waiting
- Error recovery

✅ **Advanced State Management**
- Debounced quote fetching
- Automatic balance updates
- Price tracking
- Transaction status tracking
- Context-aware error messages

✅ **Security**
- Custom error classes for proper handling
- Proper amount validation
- Deadline validation
- Network verification
- User rejection handling

✅ **User Experience**
- Loading states with descriptive messages
- Minimum output preview
- Exchange rate display
- Balance management (Max, percentage buttons)
- Token  swapping
- Error recovery suggestions

---

## Troubleshooting

### Issue: "Wrong network. Connected to X, but need BSC mainnet"

**Solution:** Switch your wallet to BSC mainnet (chainId 56)

### Issue: "Insufficient output. Swap would revert"

**Solution:** Increase slippage percentage (try 10-15% for volatile pairs)

### Issue: "User rejected the transaction"

**Solution:** This is expected if user clicks "Reject" in wallet. Just try again.

### Issue: Quote not fetching

**Solution:** 
- Check network connection
- Verify wallet is connected
- Check if Alchemy API key is configured

### Issue: Balance shows as 0

**Solution:**
- Refresh the page
- Disconnect and reconnect wallet
- Check if wallet has tokens on BSC mainnet

---

## Summary

The swap implementation provides a complete, production-ready solution for token swaps on BSC using Privy and PancakeSwap. The modular architecture allows using utilities independently or via the high-level React hook.

For questions or issues, check the inline code comments in:
- `utils/swapUtils.ts` - Core logic
- `hooks/useSwapEnhanced.ts` - React integration
