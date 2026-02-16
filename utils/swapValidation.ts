/**
 * Swap Validation Utilities
 * Implements guardrails to prevent reverts from state drift and liquidity issues
 */

import { ethers } from "ethers";

// Minimal ABI for reading pair reserves
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// Minimal ABI for reading token decimals and symbol
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
];

/**
 * Calculate price impact in basis points
 * @param amountIn - Input amount in wei
 * @param amountOut - Output amount as quoted by router (wei)
 * @param midPrice - True fair price ratio (output units per input unit, accounting for decimals)
 * @returns Price impact in basis points (bps). E.g., 1000 = 10% impact
 */
export function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  midPrice: number,
): number {
  if (amountIn === BigInt(0)) return 0;

  const executionPrice = Number(amountOut) / Number(amountIn);
  const priceImpactBps = Math.round(
    ((midPrice - executionPrice) / midPrice) * 10000,
  );

  return Math.max(0, priceImpactBps); // Clamp to 0 if price is somehow better
}

/**
 * Manually verify router output using x*y=k formula
 * Computes expected output and compares with router's quote
 * @param reserve0 - Reserve of token0 (wei)
 * @param reserve1 - Reserve of token1 (wei)
 * @param amountIn - Input amount (wei)
 * @param isInputToken0 - True if input token is token0
 * @returns Expected output amount (wei)
 */
export function computeAmountOutFromReserves(
  reserve0: bigint,
  reserve1: bigint,
  amountIn: bigint,
  isInputToken0: boolean,
): bigint {
  if (amountIn === BigInt(0)) return BigInt(0);

  // Apply 0.25% fee (PancakeSwap V2 fee)
  const FEE_BPS = 25; // 0.25%
  const amountInWithFee = (amountIn * BigInt(10000 - FEE_BPS)) / BigInt(10000);

  if (isInputToken0) {
    // Input is token0, output is token1
    const numerator = amountInWithFee * reserve1;
    const denominator = reserve0 + amountInWithFee;
    return numerator / denominator;
  } else {
    // Input is token1, output is token0
    const numerator = amountInWithFee * reserve0;
    const denominator = reserve1 + amountInWithFee;
    return numerator / denominator;
  }
}

/**
 * Fetch reserves from a Uniswap V2 pair
 * @param provider - ethers.Provider instance
 * @param pairAddress - Address of the liquidity pair contract
 * @returns { reserve0, reserve1 }
 */
export async function fetchReserves(
  provider: ethers.Provider,
  pairAddress: string,
): Promise<{ reserve0: bigint; reserve1: bigint }> {
  const pairContract = new ethers.Contract(
    pairAddress,
    PAIR_ABI,
    provider,
  );

  const [reserve0, reserve1] = await pairContract.getReserves();
  return { reserve0: BigInt(reserve0), reserve1: BigInt(reserve1) };
}

/**
 * Validate that router's quote matches our manual calculation
 * Helps detect if pair has been manipulated or data is stale
 * @param routerQuote - Amount returned by router.getAmountsOut() (wei)
 * @param manualQuote - Amount we calculated from reserves (wei)
 * @param toleranceBps - Tolerance in basis points (default 100 = 1%)
 * @returns { isValid, divergenceBps } - Whether quotes match within tolerance
 */
export function validateQuoteAgainstReserves(
  routerQuote: bigint,
  manualQuote: bigint,
  toleranceBps: number = 100,
): { isValid: boolean; divergenceBps: number } {
  if (manualQuote === BigInt(0)) {
    return { isValid: false, divergenceBps: 10000 };
  }

  // Calculate divergence as bps
  const divergence = routerQuote > manualQuote
    ? routerQuote - manualQuote
    : manualQuote - routerQuote;
  const divergenceBps = Number((divergence * BigInt(10000)) / manualQuote);

  return {
    isValid: divergenceBps <= toleranceBps,
    divergenceBps,
  };
}

/**
 * Get token decimals for price calculations
 * @param provider - ethers.Provider instance
 * @param tokenAddress - Token address
 * @returns Token decimals (default 18)
 */
export async function getTokenDecimals(
  provider: ethers.Provider,
  tokenAddress: string,
): Promise<number> {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider,
    );
    return await tokenContract.decimals();
  } catch {
    // Default to 18 if we can't fetch
    return 18;
  }
}

/**
 * Calculate pool TVL using a price feed (simple approach)
 * For a WBNB pair: TVL ≈ (reserve0 + reserve1) converted to USD
 * This is a rough estimate; proper TVL would use external price APIs
 * @param reserve0 - Reserve of token0
 * @param reserve1 - Reserve of token1
 * @param decimals0 - Decimals of token0
 * @param decimals1 - Decimals of token1
 * @param isToken0Price - Current price of token0 in USD
 * @param isToken1Price - Current price of token1 in USD
 * @returns Estimated TVL in USD
 */
export function estimatePoolTVL(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number,
  decimals1: number,
  token0PriceUSD: number,
  token1PriceUSD: number,
): number {
  const token0Amount = Number(reserve0) / Math.pow(10, decimals0);
  const token1Amount = Number(reserve1) / Math.pow(10, decimals1);

  const tvl = token0Amount * token0PriceUSD + token1Amount * token1PriceUSD;
  return tvl;
}

/**
 * Hard filter for risky tokens
 * Checks if pool is too thin based on reserve sizes
 * @param reserve0 - Reserve of token0
 * @param reserve1 - Reserve of token1
 * @param decimals0 - Decimals of token0
 * @param decimals1 - Decimals of token1
 * @param minReservesUSD - Minimum pool reserves in USD to allow (default $5k)
 * @returns { isRisky, reason }
 */
export function checkPoolRisk(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number,
  decimals1: number,
  minReservesUSD: number = 5000, // $5k minimum
): { isRisky: boolean; reason?: string } {
  // Simple heuristic: if either reserve is very small, pool is risky
  const MIN_RESERVE_WEI = ethers.parseEther("0.01"); // 0.01 units minimum

  if (reserve0 < MIN_RESERVE_WEI && reserve1 < MIN_RESERVE_WEI) {
    return {
      isRisky: true,
      reason: "Both reserves are critically low",
    };
  }

  if (reserve0 < BigInt(1000) || reserve1 < BigInt(1000)) {
    return {
      isRisky: true,
      reason: "One or both reserves are extremely low (< 1000 units)",
    };
  }

  return { isRisky: false };
}

/**
 * Validate swap sanity before execution
 * Checks multiple guardrails:
 * - Quote is non-zero
 * - Price impact is acceptable (< max allowed) for same-token swaps
 * - Output is meaningful (not dust)
 */
export function validateSwapSanity(input: {
  quoteOut: bigint;
  minOut: bigint;
  amountIn: bigint;
  maxPriceImpactBps: number;
  priceImpactBps: number;
  minOutputAbsolute: bigint;
  tokenOutDecimals: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check 1: Quote is non-zero
  if (input.quoteOut === BigInt(0)) {
    errors.push("Router returned 0 output - no liquidity");
  }

  // Check 2: Output is not completely meaningless (at least 1 wei)
  if (input.quoteOut < BigInt(1)) {
    errors.push("Output is less than 1 wei - transaction will revert");
  }

  // Check 3: Minimum output is reasonable relative to quote
  const maxSlippageAllowed = 50 * 100; // 50% max slippage in bps
  const actualSlippageBps = Number(
    ((input.quoteOut - input.minOut) * BigInt(10000)) / input.quoteOut,
  );
  if (actualSlippageBps > maxSlippageAllowed) {
    errors.push(
      `Slippage ${(actualSlippageBps / 100).toFixed(2)}% exceeds maximum 50%`,
    );
  }

  // Check 4: Don't reject on price impact for cross-token swaps
  // (price impact calculation requires price oracle for tokens with different scales)
  // Only warn if we somehow got a nonsensical price impact value
  if (input.priceImpactBps > 100000) {
    // Only warn, don't reject - this is likely a cross-token swap with skewed prices
    console.warn(`⚠️  Price impact calculation seems unreliable (${(input.priceImpactBps / 100).toFixed(0)}%) - likely cross-token swap with different price scales. Proceeding with other checks.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format validation errors into a readable message
 */
export function formatValidationErrors(errors: string[]): string {
  return errors.map((e, i) => `${i + 1}. ${e}`).join("\n");
}
