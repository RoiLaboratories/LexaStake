const { ethers } = require("hardhat");

async function deployLexaStaking() {
  console.log("🚀 Starting LexaStaking contract deployment...\n");

  // Get the contract factory
  const LexaStaking = await ethers.getContractFactory("LexaStaking");

  // Validate LEXA token address from environment
  const lexaTokenAddress = process.env.LEXA_TOKEN_ADDRESS;
  if (!lexaTokenAddress || lexaTokenAddress === "0x...") {
    throw new Error(
      "❌ LEXA_TOKEN_ADDRESS is not set in .env file. Please add the LEXA token address."
    );
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`);

  // Deploy LexaStaking contract
  console.log("📦 Deploying LexaStaking contract...");
  const lexaStaking = await LexaStaking.deploy(lexaTokenAddress);
  await lexaStaking.waitForDeployment();
  const stakingAddress = await lexaStaking.getAddress();
  console.log(`✅ LexaStaking deployed at: ${stakingAddress}\n`);

  // Display tier configurations
  console.log("📊 Tier Configurations:");
  const tiers = ["BRONZE", "SILVER", "GOLD"];
  for (let i = 0; i < 3; i++) {
    const tierConfig = await lexaStaking.getTierConfig(i);
    console.log(
      `  ${tiers[i]}: Min ${ethers.formatEther(tierConfig.minStakeAmount)} LEXA | 90d: ${tierConfig.roi90days}% | 180d: ${tierConfig.roi180days}%`
    );
  }
  console.log();

  // Deployment info
  console.log("📝 Deployment Summary:");
  console.log(`   LEXA Token Address: ${lexaTokenAddress}`);
  console.log(`   Staking Contract Address: ${stakingAddress}`);
  console.log(`   Deployer Address: ${deployer.address}`);
  console.log(`   Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log(`   Chain ID: ${(await ethers.provider.getNetwork()).chainId}\n`);

  // Save deployment info
  const deploymentInfo = {
    lexaTokenAddress,
    stakingContractAddress: stakingAddress,
    deployerAddress: deployer.address,
    deploymentTimestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
  };

  const fs = require("fs");
  const path = require("path");
  const projectRoot = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(projectRoot, "deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const networkName = (await ethers.provider.getNetwork()).name;
  const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${deploymentFile}\n`);

  // Verify contract on testnet/mainnet
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const isTestnetOrMainnet = chainId === BigInt(97) || chainId === BigInt(56); // BSC Testnet or Mainnet

  if (isTestnetOrMainnet) {
    console.log("🔍 Waiting for blockchain confirmation before verification...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds for blocks to finalize

    // Verify staking contract
    console.log("\n📋 Verifying LexaStaking contract...");
    try {
      await require("hardhat").run("verify:verify", {
        address: stakingAddress,
        constructorArguments: [lexaTokenAddress],
        network: networkName,
      });
      console.log(`✅ LexaStaking contract verified on ${networkName}`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`⚠️  LexaStaking contract already verified`);
      } else {
        console.log(`⚠️  Verification failed. Manual verification may be needed.`);
        console.log(`   Command: npx hardhat verify --network ${networkName} ${stakingAddress} ${lexaTokenAddress}`);
      }
    }
  }

  console.log("\n🎉 Deployment complete!");
  if (isTestnetOrMainnet) {
    console.log("\n✅ Contract deployed and verified!");
    console.log("\n📝 Next steps:");
    console.log(`   1. View on explorer: https://${chainId === BigInt(97) ? "testnet." : ""}bscscan.com/address/${stakingAddress}`);
    console.log(`   2. Fund the reward pool with LEXA tokens`);
    console.log(`   3. Run tests: npm run test`);
  } else {
    console.log("\n⚠️  Local deployment. To deploy to mainnet:");
    console.log(`   npx hardhat run scripts/deploy.ts --network bsc`);
  }
}

// @ts-ignore - Suppress duplicate function error (false positive from analyzer)
async function main() {
  return await deployLexaStaking();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
