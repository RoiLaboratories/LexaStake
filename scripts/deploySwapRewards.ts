/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require("hardhat");

async function deploySwapRewards() {
  const ethers = hre.ethers;
  console.log("🚀 Starting SwapReferralRewards contract deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`);

  // Get the contract factory
  const SwapReferralRewards = await ethers.getContractFactory("SwapReferralRewards");

  // Deploy SwapReferralRewards contract
  console.log("📦 Deploying SwapReferralRewards contract...");
  const swapRewards = await SwapReferralRewards.deploy();
  await swapRewards.waitForDeployment();
  const contractAddress = await swapRewards.getAddress();
  console.log(`✅ SwapReferralRewards deployed at: ${contractAddress}\n`);

  // Get initial contract state
  console.log("📊 Contract State:");
  try {
    const stats = await (swapRewards as any).getStats();
    console.log(`   Owner: ${stats.contractOwner}`);
    console.log(`   Balance: ${ethers.formatEther(stats.balance)} BNB`);
    console.log(`   Total Distributed: ${ethers.formatEther(stats.totalDistributedAmount)} BNB\n`);
  } catch (error) {
    console.log(`   ⚠️  Could not retrieve stats\n`);
  }

  // Deployment info
  const network = await ethers.provider.getNetwork();
  console.log("📝 Deployment Summary:");
  console.log(`   Contract Address: ${contractAddress}`);
  console.log(`   Deployer Address: ${deployer.address}`);
  console.log(`   Network: ${network.name}`);
  console.log(`   Chain ID: ${network.chainId}\n`);

  // Save deployment info
  const deploymentInfo = {
    contractName: "SwapReferralRewards",
    contractAddress,
    deployerAddress: deployer.address,
    ownerAddress: deployer.address,
    deploymentTimestamp: new Date().toISOString(),
    network: network.name,
    chainId: Number(network.chainId),
    verified: false,
  };

  const fs = require("fs");
  const path = require("path");
  const projectRoot = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(projectRoot, "deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const networkName = network.name;
  const deploymentFile = path.join(deploymentsDir, `${networkName}-swap-rewards-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${deploymentFile}\n`);

  // Verify contract on testnet/mainnet
  const chainId = network.chainId;
  const isTestnetOrMainnet = chainId === BigInt(97) || chainId === BigInt(56);

  if (isTestnetOrMainnet) {
    console.log("⏳ Waiting for blockchain confirmation before verification (10 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("\n🔍 Verifying SwapReferralRewards contract...");
    try {
      await require("hardhat").run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
        network: networkName,
      });
      console.log(`✅ SwapReferralRewards contract verified on ${networkName}`);
      deploymentInfo.verified = true;
      fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`⚠️  Contract already verified on ${networkName}`);
        deploymentInfo.verified = true;
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
      } else {
        console.log(`⚠️  Verification failed. Manual verification may be needed.`);
        console.log(`   Command: npx hardhat verify --network ${networkName} ${contractAddress}`);
      }
    }
  }

  console.log("\n🎉 Deployment complete!");
  console.log("\n📝 Environment Variables:");
  console.log(`   NEXT_PUBLIC_SWAP_REWARDS_CONTRACT=${contractAddress}`);
  console.log(`   CONTRACT_OWNER_PRIVATE_KEY=<your_private_key>\n`);

  if (isTestnetOrMainnet) {
    const baseUrl = chainId === BigInt(56) ? "bscscan.com" : "testnet.bscscan.com";
    console.log(`🔗 View on Explorer: https://${baseUrl}/address/${contractAddress}`);
    console.log(`📋 Verify at: https://${baseUrl}/address/${contractAddress}#code\n`);
  }
}

// @ts-ignore - Suppress duplicate function error (false positive from analyzer)
async function main() {
  return await deploySwapRewards();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
