import { ethers } from "hardhat";

/**
 * Utility script for interacting with deployed contract
 * Usage: npx hardhat run scripts/interact.ts --network <network>
 */

const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS || "";
const LEXA_TOKEN_ADDRESS = process.env.LEXA_TOKEN_ADDRESS || "";

async function main() {
  if (!STAKING_CONTRACT_ADDRESS || !LEXA_TOKEN_ADDRESS) {
    throw new Error("Contract addresses not set in .env file");
  }

  const [signer] = await ethers.getSigners();
  console.log(`📋 Interacting with contracts as: ${signer.address}\n`);

  // Get contract instances
  const lexaToken = await ethers.getContractAt("IERC20", LEXA_TOKEN_ADDRESS);
  const lexaStaking = await ethers.getContractAt("LexaStaking", STAKING_CONTRACT_ADDRESS);

  // Check token balance
  const balance = await lexaToken.balanceOf(signer.address);
  console.log(`💰 Your LEXA Balance: ${ethers.formatEther(balance)} LEXA`);

  // Check allowance
  const allowance = await lexaToken.allowance(signer.address, STAKING_CONTRACT_ADDRESS);
  console.log(`✅ Current Allowance: ${ethers.formatEther(allowance)} LEXA\n`);

  // Get user stakes
  const stakes = await lexaStaking.getUserStakes(signer.address);
  console.log(`📊 Your Stakes: ${stakes.length}`);

  if (stakes.length > 0) {
    stakes.forEach((stake: any, index: number) => {
      const tierNames = ["BRONZE", "SILVER", "GOLD"];
      const elapsed = Math.floor((Date.now() - Number(stake.startTimestamp) * 1000) / 1000 / 86400);
      const daysRemaining = Number(stake.lockDurationDays) - elapsed;

      console.log(`\n  Stake ${index + 1}:`);
      console.log(`    Amount: ${ethers.formatEther(stake.amount)} LEXA`);
      console.log(`    Tier: ${tierNames[stake.tier]}`);
      console.log(`    Duration: ${stake.lockDurationDays} days`);
      console.log(`    Days Elapsed: ${Math.max(0, elapsed)}`);
      console.log(`    Days Remaining: ${Math.max(0, daysRemaining)}`);
      console.log(`    Total Rewards: ${ethers.formatEther(stake.totalRewardsEntitled)} LEXA`);
      console.log(`    Claimed: ${ethers.formatEther(stake.totalRewardsClaimed)} LEXA`);
      console.log(`    Active: ${stake.active}`);
    });

    // Check accumulated rewards for each stake
    console.log(`\n💎 Accumulated Rewards:`);
    for (let i = 0; i < stakes.length; i++) {
      const rewards = await lexaStaking.getAccumulatedRewards(signer.address, i);
      console.log(`  Stake ${i + 1}: ${ethers.formatEther(rewards)} LEXA`);
    }
  }

  // Reward pool info
  const poolBalance = await lexaStaking.rewardPoolBalance();
  console.log(`\n🏊 Reward Pool Balance: ${ethers.formatEther(poolBalance)} LEXA`);

  // Total locked
  const totalLocked = await lexaStaking.getTotalLockedAmount();
  console.log(`🔒 Total Locked Funds: ${ethers.formatEther(totalLocked)} LEXA`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
