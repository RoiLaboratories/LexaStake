/**
 * LexaStaking Configuration & Constants
 * 
 * Central location for all configuration values
 * Update these values based on your deployment requirements
 */

export const STAKING_CONFIG = {
  // ==================== TIER CONFIGURATIONS ====================
  tiers: {
    bronze: {
      name: "Bronze",
      minStake: "10", // In LEXA (denominated in dollar equivalent)
      roi: {
        "90d": 5,    // 5%
        "180d": 10,  // 10%
      },
    },
    silver: {
      name: "Silver",
      minStake: "20",
      roi: {
        "90d": 10,   // 10%
        "180d": 25,  // 25%
      },
    },
    gold: {
      name: "Gold",
      minStake: "50",
      roi: {
        "90d": 15,   // 15%
        "180d": 35,  // 35%
      },
    },
  },

  // ==================== LOCK DURATIONS ====================
  lockDurations: {
    short: 90,   // days
    long: 180,   // days
  },

  // ==================== REFERRAL SETTINGS ====================
  referral: {
    rewardAmount: "50", // 50 LEXA per successful referral
    maxRewardPerUser: "50", // One reward per user
  },

  // ==================== REWARD POOL ====================
  rewardPool: {
    initialFunding: "100000", // Initial funding in LEXA
    minThreshold: "10000", // Alert if below this
  },

  // ==================== TIME CONSTANTS ====================
  time: {
    secondsPerDay: 86400,
    daysIn90d: 90,
    daysIn180d: 180,
    secondsIn90d: 86400 * 90,    // 7,776,000 seconds
    secondsIn180d: 86400 * 180,  // 15,552,000 seconds
  },

  // ==================== TOKEN DECIMALS ====================
  token: {
    decimals: 18,
    symbol: "LEXA",
    name: "LEXA Token",
  },

  // ==================== GAS CONSIDERATIONS ====================
  gas: {
    // Estimated gas costs on BSC
    stake: {
      bronze90d: "154000",
      silver180d: "165000",
      gold180d: "172000",
    },
    claimRewards: "86000",
    restakeRewards: "112000",
    unstake: "128000",
  },

  // ==================== PRECISION ====================
  precision: {
    percentage: 100, // For ROI calculations (5% = 5/100)
    wei: 18,         // ERC-20 standard decimals
  },
};

// ==================== DEPLOYMENT ADDRESSES ====================
export const NETWORKS = {
  hardhat: {
    name: "Hardhat",
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    isTestnet: false,
  },
  localhost: {
    name: "Localhost",
    chainId: 31337,
    rpc: "http://127.0.0.1:8545",
    isTestnet: false,
  },
  bscTestnet: {
    name: "BSC Testnet",
    chainId: 97,
    rpc: "https://data-seed-prebsc-1-1.binance.org:8545",
    isTestnet: true,
    explorer: "https://testnet.bscscan.com",
    faucet: "https://testnet.binance.org/faucet-smart",
  },
  bsc: {
    name: "BSC Mainnet",
    chainId: 56,
    rpc: "https://bsc.meowrpc.com",
    isTestnet: false,
    explorer: "https://bscscan.com",
  },
};

// ==================== OPERATION SCENARIOS ====================

/**
 * Scenario 1: Conservative Staking
 * Low stake, short duration, safe returns
 */
export const SCENARIO_CONSERVATIVE = {
  amount: "10",      // $10 worth LEXA
  tier: "bronze",    // 5% ROI
  duration: 90,      // 90 days
  expectedReward: "0.5",
  expectedAPY: "5%",
};

/**
 * Scenario 2: Balanced Staking
 * Mid-range stake, standard duration
 */
export const SCENARIO_BALANCED = {
  amount: "100",     // $100 worth LEXA
  tier: "silver",    // 10% ROI (90d) or 25% (180d)
  duration: 180,     // 180 days
  expectedReward: "25",
  expectedAPY: "12.5%", // Annualized
};

/**
 * Scenario 3: Aggressive Staking
 * Large stake, maximum duration, maximum returns
 */
export const SCENARIO_AGGRESSIVE = {
  amount: "1000",    // $1000 worth LEXA
  tier: "gold",      // 15% (90d) or 35% (180d)
  duration: 180,     // 180 days
  expectedReward: "350",
  expectedAPY: "17.5%", // Annualized
};

// ==================== TEST DATA ====================

/**
 * Mock user addresses for testing
 */
export const TEST_USERS = {
  owner: "0x0000000000000000000000000000000000000001",
  user1: "0x1111111111111111111111111111111111111111",
  user2: "0x2222222222222222222222222222222222222222",
  referrer: "0x3333333333333333333333333333333333333333",
  attacker: "0x4444444444444444444444444444444444444444",
};

/**
 * Test amounts (in LEXA with 18 decimals)
 */
export const TEST_AMOUNTS = {
  minBronze: "10000000000000000000",     // 10 LEXA
  minSilver: "20000000000000000000",     // 20 LEXA
  minGold: "50000000000000000000",       // 50 LEXA
  largeStake: "1000000000000000000000",  // 1000 LEXA
  rewardPoolFunding: "100000000000000000000000", // 100,000 LEXA
};

// ==================== VALIDATION RULES ====================

/**
 * Validate tier selection
 */
export function isValidTier(tier: number): boolean {
  return tier >= 0 && tier <= 2;
}

/**
 * Validate lock duration
 */
export function isValidDuration(days: number): boolean {
  return days === 90 || days === 180;
}

/**
 * Calculate minimum stake for tier
 */
export function getMinStakeForTier(tier: number): string {
  const tierNames = ["bronze", "silver", "gold"] as const;
  if (!isValidTier(tier)) throw new Error("Invalid tier");
  return STAKING_CONFIG.tiers[tierNames[tier]].minStake;
}

/**
 * Calculate ROI for tier and duration
 */
export function getRoiForTierAndDuration(tier: number, days: number): number {
  const tierNames = ["bronze", "silver", "gold"] as const;
  if (!isValidTier(tier)) throw new Error("Invalid tier");
  if (!isValidDuration(days)) throw new Error("Invalid duration");
  
  const tierData = STAKING_CONFIG.tiers[tierNames[tier]];
  const key = days === 90 ? "90d" : "180d";
  return tierData.roi[key as "90d" | "180d"];
}

/**
 * Calculate total rewards for a stake
 */
export function calculateRewards(amountInLexa: number, roi: number): number {
  return (amountInLexa * roi) / 100;
}

/**
 * Calculate daily rewards
 */
export function calculateDailyRewards(totalRewards: number, days: number): number {
  return totalRewards / days;
}

/**
 * Calculate accumulated rewards after N days
 */
export function calculateAccumulatedRewards(
  totalRewards: number,
  days: number,
  elapsedDays: number
): number {
  const dailyReward = calculateDailyRewards(totalRewards, days);
  return dailyReward * Math.min(elapsedDays, days);
}

// ==================== DEPLOYMENT CHECKLIST ====================

export const DEPLOYMENT_CHECKLIST = {
  preDeployment: [
    "Code reviewed by team",
    "All tests passing (100% coverage)",
    "Gas optimization verified",
    "Security audit completed",
    "Hardware wallet configured",
    "Deployment script tested on testnet",
  ],
  deployment: [
    "Deploy to testnet",
    "Verify on testnet explorer",
    "Integration test on testnet",
    "Team sign-off received",
    "Deploy to mainnet",
    "Verify on mainnet explorer",
    "Confirm function accessibility",
  ],
  postDeployment: [
    "Monitor transaction patterns",
    "Check reward pool funded",
    "Test user staking flow",
    "Distribute user documentation",
    "Community announcement",
    "Set up automated monitoring",
    "Configure alerts",
  ],
};

// ==================== ERROR MESSAGES ====================

export const ERROR_MESSAGES = {
  invalidTier: "Invalid tier selection (must be 0-2)",
  invalidDuration: "Invalid duration (must be 90 or 180 days)",
  belowMinimum: "Stake amount below minimum for selected tier",
  insufficientBalance: "Insufficient LEXA balance",
  insufficientAllowance: "Insufficient token allowance",
  insufficientPool: "Reward pool insufficient for this stake",
  stakeStillLocked: "Stake is still locked, cannot unstake yet",
  noRewardsToClaim: "No accumulated rewards to claim",
  selfReferral: "Cannot use your own address as referrer",
  stakingPaused: "Staking is currently paused by administrator",
  invalidAddress: "Invalid address provided",
};

// ==================== SUCCESS MESSAGES ====================

export const SUCCESS_MESSAGES = {
  stakeCreated: "Stake created successfully",
  rewardsClaimed: "Rewards claimed successfully",
  rewardsRestaked: "Rewards restaked successfully",
  stakeUnstaked: "Stake unstaked successfully",
  referralRewarded: "Referral reward distributed",
};

export default STAKING_CONFIG;
