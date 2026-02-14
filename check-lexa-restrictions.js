const { ethers } = require("ethers");

async function checkLEXARestrictions() {
  const rpc = "https://bsc-dataseed1.binance.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  
  const LEXA_ADDRESS = "0x6fc20e595a8704725dbd160e7c799665706e0bdd";
  const ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  
  // ERC20 ABI
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function paused() view returns (bool)",
    "function isBlacklisted(address) view returns (bool)",
    "function isWhitelisted(address) view returns (bool)",
    "function maxTransactionAmount() view returns (uint256)",
    "function maxWalletAmount() view returns (uint256)",
  ];
  
  const lexa = new ethers.Contract(LEXA_ADDRESS, ERC20_ABI, provider);
  
  try {
    console.log("🔍 CHECKING LEXA TOKEN RESTRICTIONS...\n");
    
    // Basic info
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      lexa.name(),
      lexa.symbol(),
      lexa.decimals(),
      lexa.totalSupply(),
    ]);
    
    console.log(`Token: ${name} (${symbol})`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupply)}\n`);
    
    // Check for common restrictions
    console.log("🔐 CHECKING FOR RESTRICTIONS:\n");
    
    try {
      const paused = await lexa.paused();
      console.log(`✓ Paused: ${paused ? "❌ YES (swaps disabled)" : "✅ NO"}`);
    } catch (e) {
      console.log("✓ Paused: ℹ️  No pause function");
    }
    
    try {
      const isBlacklisted = await lexa.isBlacklisted(ROUTER_ADDRESS);
      console.log(`✓ Router blacklisted: ${isBlacklisted ? "❌ YES" : "✅ NO"}`);
    } catch (e) {
      console.log("✓ Blacklist: ℹ️  No blacklist function");
    }
    
    try {
      const isWhitelisted = await lexa.isWhitelisted(ROUTER_ADDRESS);
      console.log(`✓ Router whitelisted: ${isWhitelisted ? "✅ YES" : "📋 NO"}`);
    } catch (e) {
      console.log("✓ Whitelist: ℹ️  No whitelist function");
    }
    
    try {
      const maxTx = await lexa.maxTransactionAmount();
      console.log(`✓ Max transaction: ${ethers.formatEther(maxTx)} tokens`);
    } catch (e) {
      console.log("✓ Max transaction: ℹ️  No limit");
    }
    
    try {
      const maxWallet = await lexa.maxWalletAmount();
      console.log(`✓ Max wallet: ${ethers.formatEther(maxWallet)} tokens`);
    } catch (e) {
      console.log("✓ Max wallet: ℹ️  No limit");
    }
    
    console.log("\n📊 RECOMMENDATION:");
    console.log("If you see blacklist/whitelist issues or max transaction limits,");
    console.log("the LEXA project may need to:");
    console.log("  1. Whitelist the PancakeSwap router");
    console.log("  2. Disable transfer restrictions for the router");
    console.log("  3. Increase max transaction/wallet limits");
    console.log("  4. Resume the contract if paused");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkLEXARestrictions();
