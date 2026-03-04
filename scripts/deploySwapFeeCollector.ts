import * as fs from 'fs';
import * as path from 'path';

// Hardhat injects these globally
declare let ethers: any;
declare let run: any;

async function main() {
  console.log('🚀 Deploying SwapFeeCollector Contract...\n');

  // Get network info
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log('📋 Deployment Configuration:');
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer: ${signerAddress}`);
  console.log('');

  // Deploy SwapFeeCollector
  console.log('📦 Compiling SwapFeeCollector contract...');
  const SwapFeeCollector = await ethers.getContractFactory('SwapFeeCollector');
  
  console.log('⏳ Deploying contract (this may take a moment)...\n');
  const swapFeeCollector = await SwapFeeCollector.deploy();
  
  // Wait for deployment
  const deploymentTx = swapFeeCollector.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait();
  }

  const contractAddress = await swapFeeCollector.getAddress();

  console.log('✅ SwapFeeCollector deployed successfully!\n');
  console.log('📍 Contract Address:', contractAddress);
  console.log('');

  // Get deployment details
  const deploymentCode = await ethers.provider.getCode(contractAddress);
  const codeSize = (deploymentCode.length - 2) / 2; // Convert hex string to bytes
  console.log('📊 Contract Details:');
  console.log(`   Code Size: ${codeSize} bytes`);
  console.log('');

  // Attempt to verify contract
  console.log('🔍 Attempting to verify contract on block explorer...\n');
  
  try {
    // Wait a bit for block explorers to index the contract
    console.log('⏳ Waiting for block explorer to index contract (30 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify the contract
    console.log('📝 Submitting verification...\n');
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [],
      contract: 'contracts/SwapFeeCollector.sol:SwapFeeCollector'
    });

    console.log('✅ Contract verified successfully!\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Already Verified')) {
      console.log('ℹ️  Contract already verified on block explorer\n');
    } else {
      console.warn('⚠️  Verification failed (you can verify manually later)');
      console.warn('   Error:', error instanceof Error ? error.message : String(error));
      console.log('\n   Manual verification command:');
      if (network.chainId === BigInt(97)) {
        console.log(`   npx hardhat verify --network bscTestnet "${contractAddress}"`);
      } else if (network.chainId === BigInt(56)) {
        console.log(`   npx hardhat verify --network bsc "${contractAddress}"`);
      } else {
        console.log(`   npx hardhat verify --network ${network.name} "${contractAddress}"`);
      }
      console.log('');
    }
  }

  // Save to .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Update or add the contract address
  if (envContent.includes('NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS=')) {
    envContent = envContent.replace(
      /NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS=.*/,
      `NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS=${contractAddress}`
    );
  } else {
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS=${contractAddress}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('💾 Updated .env.local with contract address');
  console.log(`   NEXT_PUBLIC_FEE_COLLECTOR_ADDRESS=${contractAddress}\n`);

  // Display next steps
  console.log('========================================');
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('========================================\n');

  const explorerName = network.chainId === BigInt(97) ? 'BSCScan Testnet' : 'BSCScan';
  const explorerUrl = network.chainId === BigInt(97) 
    ? `https://testnet.bscscan.com/address/${contractAddress}`
    : `https://bscscan.com/address/${contractAddress}`;

  console.log('📋 NEXT STEPS:\n');

  console.log('1. View Contract on Block Explorer:');
  console.log(`   ${explorerName}: ${explorerUrl}\n`);

  // Export contract info
  const deploymentInfo = {
    name: 'SwapFeeCollector',
    address: contractAddress,
    network: network.name,
    chainId: network.chainId,
    deployer: signerAddress,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  const deploymentPath = path.join(process.cwd(), 'deployments', `SwapFeeCollector-${network.chainId}.json`);
  const deploymentsDir = path.dirname(deploymentPath);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: deployments/SwapFeeCollector-${network.chainId}.json`);
  console.log('');

  console.log('🔗 Contract Address: ' + contractAddress);
  console.log('✨ Ready for fee collection!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });
