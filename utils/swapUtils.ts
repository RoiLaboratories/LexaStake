/**
 * Swap Utility Functions
 * Reusable functions for token swapping, approvals, and balance checking
 * Works with Privy wallet and PancakeSwap Router V2 on BSC
 */

import { ethers, BrowserProvider, Contract } from "ethers";
import { TOKENS } from "@/constants/tokens";

// ============================================================================
// Constants
// ============================================================================

const PANCAKESWAP_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB_ADDRESS = "0xbb4CdB9CBD36B01bD1cBaebF2De08d9173bc095c";

// Minimal ABI for ERC20 token operations
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Router V2 ABI - swap functions
const ROUTER_V2_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  "function swapExactBNBForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)",
  "function swapExactTokensForBNB(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
];

// ============================================================================
// Error Classes
// ============================================================================

export class SwapError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "SwapError";
  }
}

export class InsufficientBalanceError extends SwapError {
  constructor(token: string, available: string, required: string) {
    super(
      `Insufficient ${token} balance`,
      "INSUFFICIENT_BALANCE",
      { token, available, required },
    );
  }
}

export class ApprovalError extends SwapError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "APPROVAL_FAILED", details);
  }
}

export class SwapExecutionError extends SwapError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "SWAP_FAILED", details);
  }
}

// ============================================================================
// Balance Functions
// ============================================================================

/**
 * Get token balance for a wallet address
 * Supports both ERC20 tokens and native BNB
 */
export async function getTokenBalance(
  provider: BrowserProvider,
  tokenAddress: string,
  walletAddress: string,
): Promise<string> {
  try {
    if (!ethers.isAddress(walletAddress)) {
      throw new SwapError("Invalid wallet address", "INVALID_ADDRESS");
    }

    // For native BNB, get balance directly
    if (tokenAddress.toLowerCase() === "native_bnb" || tokenAddress === "") {
      const balance = await provider.getBalance(walletAddress);
      return ethers.formatEther(balance);
    }

    // For ERC20 tokens, use contract call
    if (!ethers.isAddress(tokenAddress)) {
      throw new SwapError("Invalid token address", "INVALID_TOKEN_ADDRESS");
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const decimals = await tokenContract.decimals();

    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    if (error instanceof SwapError) throw error;
    throw new SwapError(
      `Failed to fetch token balance: ${error instanceof Error ? error.message : String(error)}`,
      "BALANCE_FETCH_FAILED",
      { tokenAddress, walletAddress },
    );
  }
}

/**
 * Get balances for multiple tokens
 */
export async function getMultipleBalances(
  provider: BrowserProvider,
  walletAddress: string,
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  const balances: Record<string, string> = {};

  try {
    await Promise.all(
      tokenAddresses.map(async (token) => {
        balances[token] = await getTokenBalance(provider, token, walletAddress);
      }),
    );
    return balances;
  } catch (error) {
    throw new SwapError(
      `Failed to fetch multiple balances: ${error instanceof Error ? error.message : String(error)}`,
      "MULTI_BALANCE_FAILED",
      { walletAddress, tokenCount: tokenAddresses.length },
    );
  }
}

/**
 * Get user's BNB and LEXA balances
 */
export async function getUserBalances(
  provider: BrowserProvider,
  walletAddress: string,
): Promise<{ bnb: string; lexa: string }> {
  try {
    const [bnbBalance, lexaBalance] = await Promise.all([
      getTokenBalance(provider, WBNB_ADDRESS, walletAddress),
      getTokenBalance(provider, TOKENS.LEXA.address, walletAddress),
    ]);

    return { bnb: bnbBalance, lexa: lexaBalance };
  } catch (error) {
    throw new SwapError(
      `Failed to fetch user balances: ${error instanceof Error ? error.message : String(error)}`,
      "USER_BALANCES_FAILED",
      { walletAddress },
    );
  }
}

// ============================================================================
// Approval Functions
// ============================================================================

/**
 * Check token allowance
 */
export async function getAllowance(
  provider: BrowserProvider,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string = PANCAKESWAP_ROUTER_ADDRESS,
): Promise<string> {
  try {
    if (!ethers.isAddress(tokenAddress)) {
      throw new SwapError("Invalid token address", "INVALID_TOKEN_ADDRESS");
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
    const decimals = await tokenContract.decimals();

    return ethers.formatUnits(allowance, decimals);
  } catch (error) {
    if (error instanceof SwapError) throw error;
    throw new SwapError(
      `Failed to check allowance: ${error instanceof Error ? error.message : String(error)}`,
      "ALLOWANCE_CHECK_FAILED",
      { tokenAddress, ownerAddress, spenderAddress },
    );
  }
}

/**
 * Approve token spending via the signer
 * Returns the transaction hash
 */
export async function approveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string,
  spenderAddress: string = PANCAKESWAP_ROUTER_ADDRESS,
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt | null }> {
  try {
    if (!ethers.isAddress(tokenAddress)) {
      throw new ApprovalError("Invalid token address");
    }

    if (!ethers.isAddress(spenderAddress)) {
      throw new ApprovalError("Invalid spender address");
    }

    const amountBigInt = ethers.parseEther(amount);
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

    console.log(`💳 Approving ${amount} tokens for spending at ${spenderAddress.substring(0, 10)}...`);

    const tx = await tokenContract.approve(spenderAddress, amountBigInt);
    console.log(`✓ Approval tx sent: ${tx.hash}`);

    // Wait for 1 confirmation (optional - can be called after)
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt,
    };
  } catch (error) {
    if (error instanceof ApprovalError) throw error;

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("user rejected") || errorMessage.includes("rejected")) {
      throw new ApprovalError("User rejected the approval transaction");
    }

    throw new ApprovalError(
      `Failed to approve token: ${errorMessage}`,
      { tokenAddress, amount, spenderAddress },
    );
  }
}

// ============================================================================
// Quote Functions
// ============================================================================

/**
 * Calculate swap path (direct or through WBNB)
 */
export function buildSwapPath(tokenIn: string, tokenOut: string): string[] {
  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();
  const wbnbLower = WBNB_ADDRESS.toLowerCase();

  // Direct swap if one is WBNB
  if (normalizedIn === wbnbLower || normalizedOut === wbnbLower) {
    return [tokenIn, tokenOut];
  }

  // Route through WBNB for token-to-token swaps
  return [tokenIn, WBNB_ADDRESS, tokenOut];
}

/**
 * Get swap quote (amounts out) from the router
 * Returns the exact amounts you'll receive
 */
export async function getSwapQuote(
  provider: BrowserProvider,
  amountIn: string,
  tokenIn: string,
  tokenOut: string,
): Promise<{
  path: string[];
  amountIn: string;
  amountOut: string;
  exchangeRate: string;
}> {
  try {
    const path = buildSwapPath(tokenIn, tokenOut);

    // Ensure all addresses are checksummed
    const checksummedPath = path.map((addr) => ethers.getAddress(addr));

    // Convert amount to wei
    const amountInWei = ethers.parseEther(amountIn);

    const router = new Contract(PANCAKESWAP_ROUTER_ADDRESS, ROUTER_V2_ABI, provider);

    console.log(`📊 Fetching quote for ${amountIn} tokens...`);
    const amounts = await router.getAmountsOut(amountInWei, checksummedPath);

    const amountOut = ethers.formatEther(amounts[amounts.length - 1]);
    const exchangeRate = (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6);

    console.log(`✓ Quote received: ${amountIn} → ${amountOut} (rate: ${exchangeRate})`);

    return {
      path: checksummedPath,
      amountIn,
      amountOut,
      exchangeRate,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new SwapError(
      `Failed to get swap quote: ${errorMessage}`,
      "QUOTE_FAILED",
      { amountIn, tokenIn, tokenOut },
    );
  }
}

// ============================================================================
// Swap Execution Functions
// ============================================================================

/**
 * Calculate minimum output with slippage
 */
export function calculateMinimumOutput(
  amountOut: string,
  slippagePercent: string,
): string {
  const amount = parseFloat(amountOut);
  const slippage = parseFloat(slippagePercent);

  if (isNaN(amount) || isNaN(slippage)) {
    throw new SwapError(
      "Invalid amount or slippage",
      "INVALID_SLIPPAGE",
    );
  }

  const slippageMultiplier = 1 - slippage / 100;
  const minimumAmount = amount * slippageMultiplier;

  return minimumAmount.toFixed(6);
}

/**
 * Execute a token-to-token swap
 * First token must be approved before calling this
 */
export async function executeTokenSwap(
  signer: ethers.Signer,
  amountIn: string,
  amountOutMin: string,
  path: string[],
  recipientAddress: string,
  deadline: number = Math.floor(Date.now() / 1000) + 20 * 60, // 20 mins default
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt | null }> {
  try {
    if (path.length < 2) {
      throw new SwapExecutionError("Invalid swap path");
    }

    const amountInWei = ethers.parseEther(amountIn);
    const amountOutMinWei = ethers.parseEther(amountOutMin);

    const router = new Contract(PANCAKESWAP_ROUTER_ADDRESS, ROUTER_V2_ABI, signer);

    console.log(`🔄 Executing token-to-token swap: ${amountIn} → min ${amountOutMin}`);

    const tx = await router.swapExactTokensForTokens(
      amountInWei,
      amountOutMinWei,
      path,
      recipientAddress,
      deadline,
    );

    console.log(`✓ Swap tx sent: ${tx.hash}`);

    // Optionally wait for 1 confirmation
    const receipt = await tx.wait();

    return { hash: tx.hash, receipt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("user rejected")) {
      throw new SwapExecutionError("User rejected the swap transaction");
    }

    if (errorMessage.includes("slippage") || errorMessage.includes("insufficient")) {
      throw new SwapExecutionError(
        "Swap would revert - insufficient output amount or liquidity",
        { details: errorMessage },
      );
    }

    throw new SwapExecutionError(
      `Failed to execute swap: ${errorMessage}`,
      { amountIn, amountOutMin, path },
    );
  }
}

/**
 * Execute a BNB-to-token swap (send value directly)
 */
export async function executeBNBToTokenSwap(
  signer: ethers.Signer,
  amountInBNB: string,
  amountOutMin: string,
  tokenOut: string,
  recipientAddress: string,
  deadline: number = Math.floor(Date.now() / 1000) + 20 * 60,
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt | null }> {
  try {
    const amountInWei = ethers.parseEther(amountInBNB);
    const amountOutMinWei = ethers.parseEther(amountOutMin);
    const path = [WBNB_ADDRESS, tokenOut];

    const router = new Contract(PANCAKESWAP_ROUTER_ADDRESS, ROUTER_V2_ABI, signer);

    console.log(`💰 Executing BNB → token swap: ${amountInBNB} BNB → min ${amountOutMin} tokens`);

    const tx = await router.swapExactBNBForTokens(
      amountOutMinWei,
      path,
      recipientAddress,
      deadline,
      { value: amountInWei },
    );

    console.log(`✓ Swap tx sent: ${tx.hash}`);

    const receipt = await tx.wait();

    return { hash: tx.hash, receipt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("user rejected")) {
      throw new SwapExecutionError("User rejected the swap transaction");
    }

    throw new SwapExecutionError(
      `Failed to execute BNB swap: ${errorMessage}`,
      { amountInBNB, amountOutMin, tokenOut },
    );
  }
}

/**
 * Execute a token-to-BNB swap
 * Token must be approved before calling this
 */
export async function executeTokenToBNBSwap(
  signer: ethers.Signer,
  amountIn: string,
  amountOutMin: string,
  tokenIn: string,
  recipientAddress: string,
  deadline: number = Math.floor(Date.now() / 1000) + 20 * 60,
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt | null }> {
  try {
    const amountInWei = ethers.parseEther(amountIn);
    const amountOutMinWei = ethers.parseEther(amountOutMin);
    const path = [tokenIn, WBNB_ADDRESS];

    const router = new Contract(PANCAKESWAP_ROUTER_ADDRESS, ROUTER_V2_ABI, signer);

    console.log(`💸 Executing token → BNB swap: ${amountIn} tokens → min ${amountOutMin} BNB`);

    const tx = await router.swapExactTokensForBNB(
      amountInWei,
      amountOutMinWei,
      path,
      recipientAddress,
      deadline,
    );

    console.log(`✓ Swap tx sent: ${tx.hash}`);

    const receipt = await tx.wait();

    return { hash: tx.hash, receipt };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("user rejected")) {
      throw new SwapExecutionError("User rejected the swap transaction");
    }

    throw new SwapExecutionError(
      `Failed to execute token-to-BNB swap: ${errorMessage}`,
      { amountIn, amountOutMin, tokenIn },
    );
  }
}

// ============================================================================
// Unified Swap Function
// ============================================================================

/**
 * High-level swap execution function
 * Handles approval, validation, and swap execution
 */
export async function executeSwap(
  signer: ethers.Signer,
  provider: BrowserProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  amountOut: string,
  slippagePercent: string,
  recipientAddress: string,
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt | null }> {
  try {
    const amountOutMin = calculateMinimumOutput(amountOut, slippagePercent);
    const isBNBInput = tokenIn.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const isBNBOutput = tokenOut.toLowerCase() === WBNB_ADDRESS.toLowerCase();

    // For token input (LEXA), check and request approval if needed
    if (!isBNBInput) {
      console.log(`🔐 Checking approval for ${tokenIn.substring(0, 10)}...`);

      const currentAllowance = await getAllowance(
        provider,
        tokenIn,
        recipientAddress,
        PANCAKESWAP_ROUTER_ADDRESS,
      );

      if (parseFloat(currentAllowance) < parseFloat(amountIn)) {
        console.log(`⚠️ Approval required. Current: ${currentAllowance}, Need: ${amountIn}`);
        await approveToken(signer, tokenIn, amountIn);
      } else {
        console.log(`✓ Sufficient allowance: ${currentAllowance}`);
      }
    }

    // Execute the appropriate swap
    if (isBNBInput) {
      return await executeBNBToTokenSwap(
        signer,
        amountIn,
        amountOutMin,
        tokenOut,
        recipientAddress,
      );
    } else if (isBNBOutput) {
      return await executeTokenToBNBSwap(
        signer,
        amountIn,
        amountOutMin,
        tokenIn,
        recipientAddress,
      );
    } else {
      const path = buildSwapPath(tokenIn, tokenOut);
      return await executeTokenSwap(
        signer,
        amountIn,
        amountOutMin,
        path,
        recipientAddress,
      );
    }
  } catch (error) {
    if (error instanceof SwapError) throw error;
    throw new SwapExecutionError(
      `Failed to execute swap: ${error instanceof Error ? error.message : String(error)}`,
      { tokenIn, tokenOut, amountIn },
    );
  }
}

// ============================================================================
// Network Validation
// ============================================================================

/**
 * Verify the provider is connected to BSC mainnet
 */
export async function verifyBSCNetwork(provider: BrowserProvider): Promise<boolean> {
  try {
    const network = await provider.getNetwork();

    if (network.chainId !== BigInt(56)) {
      throw new SwapError(
        `Wrong network. Connected to ${network.name} (${network.chainId}), but need BSC mainnet (56)`,
        "WRONG_NETWORK",
        { currentChainId: network.chainId.toString(), expectedChainId: "56" },
      );
    }

    console.log(`✓ Connected to BSC mainnet (chainId: ${network.chainId})`);
    return true;
  } catch (error) {
    if (error instanceof SwapError) throw error;
    throw new SwapError(
      `Failed to verify network: ${error instanceof Error ? error.message : String(error)}`,
      "NETWORK_VERIFICATION_FAILED",
    );
  }
}

// ============================================================================
// Transaction Utilities
// ============================================================================

/**
 * Calculate transaction fee estimate in BNB
 */
export function estimateGasCost(
  gasLimit: string,
  gasPrice: string, // in wei
): string {
  const gasCost = BigInt(gasLimit) * BigInt(gasPrice);
  return ethers.formatEther(gasCost);
}

/**
 * Format transaction data for display
 */
export function formatSwapData(
  amountIn: string,
  amountOut: string,
  tokenInSymbol: string,
  tokenOutSymbol: string,
): string {
  return `${amountIn} ${tokenInSymbol} → ${amountOut} ${tokenOutSymbol}`;
}
