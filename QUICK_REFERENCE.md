/**
 * QUICK REFERENCE GUIDE - Swap Functionality
 * 
 * Copy-paste examples for common swap operations
 */

// ============================================================================
// IMPORT STATEMENTS
// ============================================================================

// Using the React hook (easiest for components)
import { useSwapEnhanced } from "@/hooks/useSwapEnhanced";

// Using utilities directly (for non-React code or testing)
import {
  getTokenBalance,
  getUserBalances,
  getSwapQuote,
  getAllowance,
  approveToken,
  executeSwap,
  executeTokenSwap,
  executeBNBToTokenSwap,
  executeTokenToBNBSwap,
  buildSwapPath,
  calculateMinimumOutput,
  verifyBSCNetwork,
  SwapError,
  InsufficientBalanceError,
  ApprovalError,
  SwapExecutionError,
} from "@/utils/swapUtils";

import { BrowserProvider } from "ethers";
import { TOKENS } from "@/constants/tokens";

// ============================================================================
// 1. BASIC SWAP IN A REACT COMPONENT
// ============================================================================

// app/components/SimpleSwap.tsx
export function SimpleSwap() {
  const { sellAmount, executeSwap } = useSwapEnhanced();

  return (
    <button onClick={executeSwap} disabled={!sellAmount}>
      Swap Now
    </button>
  );
}

// ============================================================================
// 2. GET TOKEN BALANCE
// ============================================================================

async function checkBalance() {
  const provider = new BrowserProvider(window.ethereum!);
  const userAddress = "0x..."; // Your address
  
  // Single token
  const balance = await getTokenBalance(
    provider,
    TOKENS.LEXA.address,
    userAddress
  );
  console.log("LEXA Balance:", balance);
  
  // Multiple tokens at once
  const { bnb, lexa } = await getUserBalances(provider, userAddress);
  console.log("BNB:", bnb, "LEXA:", lexa);
}

// ============================================================================
// 3. FETCH A QUOTE
// ============================================================================

async function getQuoteExample() {
  const provider = new BrowserProvider(window.ethereum!);
  
  const quote = await getSwapQuote(
    provider,
    "100",                    // 100 tokens (in ether format)
    TOKENS.LEXA.address,      // from LEXA
    TOKENS.BNB.address        // to BNB (uses WBNB internally)
  );
  
  console.log("You'll get:", quote.amountOut, "BNB");
  console.log("Exchange rate:", quote.exchangeRate);
}

// ============================================================================
// 4. APPROVE TOKEN SPENDING
// ============================================================================

async function approveExample() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  
  // Approve 1000 LEXA for PancakeSwap
  const { hash, receipt } = await approveToken(
    signer,
    TOKENS.LEXA.address,
    "1000", // amount in ether format
    "0x10ED43C718714eb63d5aA57B78B54704E256024E" // Router address (optional, default included)
  );
  
  console.log("Approval tx:", hash);
  if (receipt) console.log("Confirmed!");
}

// ============================================================================
// 5. EXECUTE A SIMPLE SWAP
// ============================================================================

async function simpleSwap() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Swap 100 LEXA for BNB
  const result = await executeSwap(
    signer,
    provider,
    TOKENS.LEXA.address,
    TOKENS.BNB.address,
    "100",      // amount in
    "0.5",      // amount out (max acceptable)
    "1",        // 1% slippage
    userAddress
  );

  console.log("Swap hash:", result.hash);
}

// ============================================================================
// 6. SWAP WITH CUSTOM PATH
// ============================================================================

async function advancedSwap() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Build custom path
  const path = buildSwapPath(
    TOKENS.LEXA.address,
    TOKENS.BNB.address
  );
  
  // Get quote for this path
  const quote = await getSwapQuote(
    provider,
    "100",
    TOKENS.LEXA.address,
    TOKENS.BNB.address
  );

  // Calculate min output
  const minOutput = calculateMinimumOutput(quote.amountOut, "0.5"); // 0.5% slippage

  // Execute the swap
  const result = await executeTokenSwap(
    signer,
    "100",              // amount in
    minOutput,          // min amount out
    path,               // swap path [LEXA, WBNB, BNB]
    userAddress,        // recipient
    Math.floor(Date.now() / 1000) + 20 * 60 // 20 minute deadline
  );

  console.log("Swap complete:", result.hash);
}

// ============================================================================
// 7. BNB TO TOKEN SWAP (no approval needed)
// ============================================================================

async function bnbToTokenSwap() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Swap 1 BNB for LEXA (no approval needed!)
  const result = await executeBNBToTokenSwap(
    signer,
    "1",                        // 1 BNB
    "0",                        // accept any amount out (not recommended)
    TOKENS.LEXA.address,        // token to receive
    userAddress
  );

  console.log("Swap hash:", result.hash);
}

// ============================================================================
// 8. TOKEN TO BNB SWAP (approval required)
// ============================================================================

async function tokenToBnbSwap() {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // First: Check allowance
  const allowance = await getAllowance(
    provider,
    TOKENS.LEXA.address,
    userAddress
  );

  // Second: Approve if needed
  if (parseFloat(allowance) < 100) {
    await approveToken(signer, TOKENS.LEXA.address, "100");
  }

  // Third: Execute swap
  const result = await executeTokenToBNBSwap(
    signer,
    "100",                  // 100 LEXA tokens
    "0.4",                  // expect at least 0.4 BNB
    TOKENS.LEXA.address,
    userAddress
  );

  console.log("Swap hash:", result.hash);
}

// ============================================================================
// 9. ERROR HANDLING
// ============================================================================

async function swapWithErrorHandling() {
  try {
    const provider = new BrowserProvider(window.ethereum!);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    await executeSwap(
      signer,
      provider,
      TOKENS.LEXA.address,
      TOKENS.BNB.address,
      "100",
      "0.5",
      "1",
      userAddress
    );
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      console.error(
        `Not enough ${error.details?.token}. Have: ${error.details?.available}, Need: ${error.details?.required}`
      );
    } else if (error instanceof ApprovalError) {
      console.error("Approval failed:", error.message);
    } else if (error instanceof SwapExecutionError) {
      console.error("Swap failed:", error.message);
      console.log("Details:", error.details);
    } else if (error instanceof SwapError) {
      console.error("Swap error code:", error.code);
      console.error("Details:", error.details);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

// ============================================================================
// 10. VERIFY NETWORK (BSC REQUIRED)
// ============================================================================

async function verifyAndSwap() {
  const provider = new BrowserProvider(window.ethereum!);
  
  try {
    // This will throw if not on BSC
    await verifyBSCNetwork(provider);
    console.log("✓ Connected to BSC mainnet");
    
    // Proceed with swap...
  } catch (error) {
    console.error("Wrong network:", error.message);
  }
}

// ============================================================================
// 11. REACT HOOK EXAMPLE - FULL COMPONENT
// ============================================================================

import React, { useState } from "react";

export function SwapComponent() {
  const [customSlippage, setCustomSlippage] = useState("1");
  
  const {
    sellToken,
    receiveToken,
    sellAmount,
    receiveAmount,
    balance,
    quote,
    errorMessage,
    transactionStatus,
    isLoadingQuote,
    
    setSellAmount,
    swapTokens,
    handleMaxAmount,
    executeSwap,
  } = useSwapEnhanced();

  const isDisabled = 
    !sellAmount || 
    parseFloat(sellAmount) > parseFloat(balance) ||
    transactionStatus === "loading";

  return (
    <div>
      <h2>Swap {sellToken.symbol} for {receiveToken.symbol}</h2>

      <input
        type="number"
        value={sellAmount}
        onChange={(e) => setSellAmount(e.target.value)}
        placeholder="Amount to swap"
      />
      <button onClick={handleMaxAmount}>MAX</button>

      <button onClick={swapTokens}>⇅ Swap Direction</button>

      <div>
        {isLoadingQuote ? "Loading..." : receiveAmount}
      </div>

      {quote && (
        <div>
          Rate: {quote.exchangeRate}
          <br />
          Min received: {quote.minimumReceived}
        </div>
      )}

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      <button onClick={executeSwap} disabled={isDisabled}>
        {transactionStatus === "loading" ? "Swapping..." : "Swap"}
      </button>
    </div>
  );
}

// ============================================================================
// 12. CHECKING BALANCE AND ALLOWANCE
// ============================================================================

async function checkBalanceAndAllowance() {
  const provider = new BrowserProvider(window.ethereum!);
  const userAddress = "0x...";
  const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

  // Check LEXA balance
  const balance = await getTokenBalance(
    provider,
    TOKENS.LEXA.address,
    userAddress
  );
  console.log("Balance:", balance);

  // Check allowance
  const allowance = await getAllowance(
    provider,
    TOKENS.LEXA.address,
    userAddress,
    routerAddress
  );
  console.log("Allowance:", allowance);

  // Check if approval needed
  if (parseFloat(allowance) < parseFloat("100")) {
    console.log("Need approval!");
  } else {
    console.log("Already approved!");
  }
}

// ============================================================================
// 13. GET BOTH BALANCES IN ONE CALL
// ============================================================================

async function getBothBalances() {
  const provider = new BrowserProvider(window.ethereum!);
  const userAddress = "0x...";

  const { bnb, lexa } = await getUserBalances(provider, userAddress);

  console.log("BNB:", bnb);
  console.log("LEXA:", lexa);

  // Calculate total value
  const prices = { bnb: 600, lexa: 0.0001 }; // Example prices
  const totalUsd = 
    parseFloat(bnb) * prices.bnb + 
    parseFloat(lexa) * prices.lexa;
  
  console.log("Total value:", totalUsd, "USD");
}

// ============================================================================
// 14. IN A TESTING CONTEXT
// ============================================================================

describe("Swap Functions", () => {
  it("should get token balance", async () => {
    const balance = await getTokenBalance(
      provider,
      tokenAddress,
      walletAddress
    );

    expect(balance).toMatch(/^\d+(\.\d+)?$/); // Should be a number string
  });

  it("should calculate minimum output correctly", () => {
    const min = calculateMinimumOutput("100", "1"); // 100 tokens, 1% slippage
    expect(parseFloat(min)).toBe(99);
  });

  it("should build correct swap path", () => {
    const path = buildSwapPath(TOKENS.LEXA.address, TOKENS.BNB.address);
    expect(path.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 15. HANDLING TRANSACTION RESULTS
// ============================================================================

async function handleSwapResult() {
  const result = await executeSwap(
    signer,
    provider,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    slippage,
    userAddress
  );

  // result has:
  // - hash: transaction hash (string)
  // - receipt: transaction receipt (optional)

  console.log("Transaction hash:", result.hash);
  
  if (result.receipt) {
    console.log("Block number:", result.receipt.blockNumber);
    console.log("Gas used:", result.receipt.gasUsed);
    console.log("Status:", result.receipt.status === 1 ? "Success" : "Failed");
  }

  // You can use the hash to track transaction status elsewhere
  // or redirect user to block explorer:
  const blockExplorerUrl = `https://bscscan.com/tx/${result.hash}`;
  console.log("View on explorer:", blockExplorerUrl);
}

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * Pattern 1: Full swap flow with error recovery
 */
async function fullSwapFlow() {
  try {
    const provider = new BrowserProvider(window.ethereum!);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    // Verify network
    await verifyBSCNetwork(provider);

    // Check balance
    const balance = await getTokenBalance(provider, tokenIn, userAddress);
    if (parseFloat(balance) < parseFloat(amountIn)) {
      throw new InsufficientBalanceError(
        "LEXA",
        balance,
        amountIn
      );
    }

    // Check & request approval
    const allowance = await getAllowance(provider, tokenIn, userAddress);
    if (parseFloat(allowance) < parseFloat(amountIn)) {
      await approveToken(signer, tokenIn, amountIn);
    }

    // Get quote
    const quote = await getSwapQuote(provider, amountIn, tokenIn, tokenOut);

    // Execute swap
    const result = await executeSwap(
      signer,
      provider,
      tokenIn,
      tokenOut,
      amountIn,
      quote.amountOut,
      slippagePercent,
      userAddress
    );

    return { success: true, hash: result.hash };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Pattern 2: Simple hook-based approach in React
 */
function SimpleSwapForm() {
  const {
    sellAmount,
    setSellAmount,
    executeSwap,
    errorMessage,
  } = useSwapEnhanced();

  return (
    <>
      <input value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
      <button onClick={executeSwap}>Swap</button>
      {errorMessage && <p>{errorMessage}</p>}
    </>
  );
}

export default SwapComponent;
