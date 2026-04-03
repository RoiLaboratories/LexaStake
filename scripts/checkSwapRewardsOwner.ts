import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

/**
 * Check the actual owner of the SwapReferralRewards contract on-chain
 */
async function checkOwner() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed1.binance.org:443';
    const contractAddress = process.env.NEXT_PUBLIC_SWAP_REWARDS_CONTRACT;
    const signerPrivateKey = process.env.REFERRAL_DISTRIBUTOR_PRIVATE_KEY;

    if (!contractAddress) {
      throw new Error('NEXT_PUBLIC_SWAP_REWARDS_CONTRACT not set');
    }

    if (!signerPrivateKey) {
      throw new Error('REFERRAL_DISTRIBUTOR_PRIVATE_KEY not set');
    }

    console.log('🔍 Checking SwapReferralRewards Contract Owner');
    console.log('─'.repeat(60));
    console.log(`📍 Contract: ${contractAddress}`);
    console.log(`🌐 RPC: ${rpcUrl.substring(0, 50)}...`);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const normalizedKey = signerPrivateKey.startsWith('0x') ? signerPrivateKey : `0x${signerPrivateKey}`;
    const wallet = new ethers.Wallet(normalizedKey, provider);

    console.log(`\n👤 Your Signer Address: ${wallet.address}`);

    // Get the contract owner
    const abi = ['function owner() view returns (address)'];
    const contract = new ethers.Contract(contractAddress, abi, provider);

    try {
      const actualOwner = await contract.owner();
      console.log(`🔐 Actual Contract Owner: ${actualOwner}`);

      // Check if they match
      const matches = actualOwner.toLowerCase() === wallet.address.toLowerCase();
      console.log(`\n${matches ? '✅' : '❌'} Owner Match: ${matches ? 'YES' : 'NO'}`);

      if (!matches) {
        console.log('\n⚠️  PROBLEM FOUND:');
        console.log(`   Your signer: ${wallet.address}`);
        console.log(`   Contract owner: ${actualOwner}`);
        console.log('\n💡 SOLUTION:');
        console.log('   You need the private key for:', actualOwner);
        console.log('   Or transfer ownership to:', wallet.address);
      } else {
        console.log('\n✅ Your private key matches the contract owner!');
        console.log('   Issue must be something else.');
      }
    } catch (error) {
      console.error('❌ Could not read owner() function');
      console.error('   This contract may not have an owner() function');
      console.error('   Error:', error instanceof Error ? error.message : error);
    }

    // Also check contract code exists
    const code = await provider.getCode(contractAddress);
    console.log(`\n📝 Contract Has Code: ${code.length > 2 ? 'YES ✅' : 'NO ❌'}`);

    // Check balance
    const balance = await provider.getBalance(contractAddress);
    console.log(`💰 Contract Balance: ${ethers.formatEther(balance)} BNB`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkOwner();
