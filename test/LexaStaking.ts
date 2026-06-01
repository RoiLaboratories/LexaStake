import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const DAY = 24 * 60 * 60;
const { ethers } = hre;

describe("LexaStaking", function () {
  async function deployFixture(fundRewards = true) {
    const [owner, user, referrer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockLexaToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Staking = await ethers.getContractFactory("LexaStaking");
    const staking = await Staking.deploy(await token.getAddress());
    await staking.waitForDeployment();

    const stakingAddress = await staking.getAddress();

    await token.transfer(user.address, ethers.parseEther("1000"));

    if (fundRewards) {
      await token.approve(stakingAddress, ethers.parseEther("100000"));
      await staking.fundRewardPool(ethers.parseEther("100000"));
    }

    return { owner, user, referrer, token, staking, stakingAddress };
  }

  it("reserves rewards on stake and blocks reward claims until maturity", async function () {
    const { user, token, staking, stakingAddress } = await deployFixture();
    const amount = ethers.parseEther("100");
    const reward = ethers.parseEther("5");

    await token.connect(user).approve(stakingAddress, amount);
    await expect(staking.connect(user).stake(amount, 0, 90, ethers.ZeroAddress))
      .to.emit(staking, "Staked");

    expect(await staking.userStakeCount(user.address)).to.equal(1);
    expect(await staking.totalLockedPrincipal()).to.equal(amount);
    expect(await staking.reservedRewardBalance()).to.equal(reward);
    expect(await staking.rewardPoolBalance()).to.equal(ethers.parseEther("99995"));
    expect(await staking.getAccumulatedRewards(user.address, 0)).to.equal(0);

    await expect(staking.connect(user).claimRewards(0)).to.be.revertedWith("Stake is still locked");

    await time.increase(90 * DAY);

    expect(await staking.getAccumulatedRewards(user.address, 0)).to.equal(reward);

    await staking.connect(user).claimRewards(0);

    expect(await staking.reservedRewardBalance()).to.equal(0);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("905"));

    await staking.connect(user).unstake(0);

    expect(await staking.totalLockedPrincipal()).to.equal(0);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1005"));
  });

  it("returns principal and unclaimed rewards together after maturity", async function () {
    const { user, token, staking, stakingAddress } = await deployFixture();
    const amount = ethers.parseEther("100");
    const reward = ethers.parseEther("5");

    await token.connect(user).approve(stakingAddress, amount);
    await staking.connect(user).stake(amount, 0, 90, ethers.ZeroAddress);

    await expect(staking.connect(user).unstake(0)).to.be.revertedWith("Stake is still locked");

    await time.increase(90 * DAY);
    await staking.connect(user).unstake(0);

    const stake = await staking.userStakes(user.address, 0);
    expect(stake.active).to.equal(false);
    expect(await staking.totalLockedPrincipal()).to.equal(0);
    expect(await staking.reservedRewardBalance()).to.equal(0);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000") + reward);
  });

  it("requires the reward pool to back staking rewards up front", async function () {
    const { user, token, staking, stakingAddress } = await deployFixture(false);
    const amount = ethers.parseEther("100");

    await token.connect(user).approve(stakingAddress, amount);

    await expect(
      staking.connect(user).stake(amount, 0, 90, ethers.ZeroAddress)
    ).to.be.revertedWith("Insufficient reward pool");

    expect(await staking.totalLockedPrincipal()).to.equal(0);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });

  it("does not let excess withdrawals drain locked principal or reserved rewards", async function () {
    const { user, token, staking, stakingAddress } = await deployFixture();
    const amount = ethers.parseEther("100");
    const reward = ethers.parseEther("5");

    await token.connect(user).approve(stakingAddress, amount);
    await staking.connect(user).stake(amount, 0, 90, ethers.ZeroAddress);

    await expect(staking.withdrawExcessTokens(1)).to.be.revertedWith("Insufficient excess tokens");

    await staking.emergencyRecoverTokens(await staking.rewardPoolBalance());

    expect(await token.balanceOf(stakingAddress)).to.equal(amount + reward);

    await time.increase(90 * DAY);
    await staking.connect(user).unstake(0);

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000") + reward);
  });

  it("pays referral rewards from the unreserved reward pool", async function () {
    const { user, referrer, token, staking, stakingAddress } = await deployFixture();
    const amount = ethers.parseEther("100");
    const stakingReward = ethers.parseEther("5");
    const referralReward = ethers.parseEther("50");

    await token.connect(user).approve(stakingAddress, amount);

    await expect(staking.connect(user).stake(amount, 0, 90, referrer.address))
      .to.emit(staking, "ReferralRewarded");

    expect(await token.balanceOf(referrer.address)).to.equal(referralReward);
    expect(await staking.reservedRewardBalance()).to.equal(stakingReward);
    expect(await staking.rewardPoolBalance()).to.equal(ethers.parseEther("99945"));
  });
});
