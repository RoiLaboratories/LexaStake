import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;
const FEE_BPS = BigInt(30);
const BASIS_POINTS = BigInt(10000);
const NATIVE_TOKEN = ethers.ZeroAddress;

interface DeployedContract {
  waitForDeployment(): Promise<unknown>;
  getAddress(): Promise<string>;
}

interface MockTokenContract extends DeployedContract {
  transfer(to: string, amount: bigint): Promise<unknown>;
  balanceOf(account: string): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<unknown>;
  connect(signer: unknown): MockTokenContract;
}

interface SwapExecutorContract extends DeployedContract {
  executeSwapExactETHForTokens(
    amountOutMin: bigint | number,
    path: string[],
    recipient: string,
    deadline: number,
    overrides: { value: bigint },
  ): Promise<unknown>;
  executeSwapExactTokensForETH(
    inputToken: string,
    amountIn: bigint,
    amountOutMin: bigint | number,
    path: string[],
    recipient: string,
    deadline: number,
  ): Promise<unknown>;
  executeSwapExactTokensForTokens(
    inputToken: string,
    amountIn: bigint,
    amountOutMin: bigint | number,
    path: string[],
    recipient: string,
    deadline: number,
  ): Promise<unknown>;
  availableFees(token: string): Promise<bigint>;
  withdrawAllTokenFees(token: string): Promise<unknown>;
  withdrawAllNativeFees(): Promise<unknown>;
  connect(signer: unknown): SwapExecutorContract;
}

function feeOf(amount: bigint) {
  return (amount * FEE_BPS) / BASIS_POINTS;
}

describe("SwapExecutor", function () {
  async function deployFixture() {
    const [owner, user, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockLexaToken");
    const inputToken = await Token.deploy() as unknown as MockTokenContract;
    await inputToken.waitForDeployment();
    const outputToken = await Token.deploy() as unknown as MockTokenContract;
    await outputToken.waitForDeployment();
    const wbnb = await Token.deploy() as unknown as MockTokenContract;
    await wbnb.waitForDeployment();

    const Router = await ethers.getContractFactory("MockPancakeRouter");
    const router = await Router.deploy() as unknown as DeployedContract;
    await router.waitForDeployment();

    const Executor = await ethers.getContractFactory("SwapExecutor");
    const executor = await Executor.deploy(
      await router.getAddress(),
      await wbnb.getAddress(),
      treasury.address,
    ) as unknown as SwapExecutorContract;
    await executor.waitForDeployment();

    await outputToken.transfer(await router.getAddress(), ethers.parseEther("100000"));
    await owner.sendTransaction({
      to: await router.getAddress(),
      value: ethers.parseEther("100"),
    });
    await inputToken.transfer(user.address, ethers.parseEther("1000"));

    return {
      owner,
      user,
      treasury,
      inputToken,
      outputToken,
      wbnb,
      router,
      executor,
    };
  }

  it("keeps 0.3% of BNB to token output and withdraws it to treasury", async function () {
    const { user, treasury, outputToken, wbnb, executor } = await deployFixture();
    const inputAmount = ethers.parseEther("1");
    const outputAmount = inputAmount * BigInt(100);
    const feeAmount = feeOf(outputAmount);
    const userAmount = outputAmount - feeAmount;

    await executor.connect(user).executeSwapExactETHForTokens(
      0,
      [await wbnb.getAddress(), await outputToken.getAddress()],
      user.address,
      Math.floor(Date.now() / 1000) + 3600,
      { value: inputAmount },
    );

    expect(await outputToken.balanceOf(user.address)).to.equal(userAmount);
    expect(await outputToken.balanceOf(await executor.getAddress())).to.equal(feeAmount);
    expect(await executor.availableFees(await outputToken.getAddress())).to.equal(feeAmount);

    await executor.withdrawAllTokenFees(await outputToken.getAddress());
    expect(await outputToken.balanceOf(treasury.address)).to.equal(feeAmount);
    expect(await executor.availableFees(await outputToken.getAddress())).to.equal(0);
  });

  it("keeps 0.3% of token to BNB output and withdraws it to treasury", async function () {
    const { user, treasury, inputToken, wbnb, executor } = await deployFixture();
    const inputAmount = ethers.parseEther("10");
    const outputAmount = inputAmount / BigInt(2);
    const feeAmount = feeOf(outputAmount);

    await inputToken.connect(user).approve(await executor.getAddress(), inputAmount);

    await executor.connect(user).executeSwapExactTokensForETH(
      await inputToken.getAddress(),
      inputAmount,
      0,
      [await inputToken.getAddress(), await wbnb.getAddress()],
      user.address,
      Math.floor(Date.now() / 1000) + 3600,
    );

    expect(await ethers.provider.getBalance(await executor.getAddress())).to.equal(feeAmount);
    expect(await executor.availableFees(NATIVE_TOKEN)).to.equal(feeAmount);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await executor.withdrawAllNativeFees();
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBefore + feeAmount);
    expect(await executor.availableFees(NATIVE_TOKEN)).to.equal(0);
  });

  it("keeps 0.3% of token to token output", async function () {
    const { user, inputToken, outputToken, wbnb, executor } = await deployFixture();
    const inputAmount = ethers.parseEther("10");
    const outputAmount = inputAmount * BigInt(2);
    const feeAmount = feeOf(outputAmount);
    const userAmount = outputAmount - feeAmount;

    await inputToken.connect(user).approve(await executor.getAddress(), inputAmount);

    await executor.connect(user).executeSwapExactTokensForTokens(
      await inputToken.getAddress(),
      inputAmount,
      0,
      [await inputToken.getAddress(), await wbnb.getAddress(), await outputToken.getAddress()],
      user.address,
      Math.floor(Date.now() / 1000) + 3600,
    );

    expect(await outputToken.balanceOf(user.address)).to.equal(userAmount);
    expect(await executor.availableFees(await outputToken.getAddress())).to.equal(feeAmount);
  });
});
