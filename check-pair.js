const { ethers } = require("ethers");

async function checkPair() {
  const rpc = "https://bsc-dataseed1.binance.org";
  const provider = new ethers.JsonRpcProvider(rpc, {
    chainId: 56,
    name: "bsc"
  }, {
    staticNetwork: true,  // Disable checksum validation in static mode
  });
  
  const PANCAKESWAP_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
  const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";  
  const LEXA = "0x6fc20e595a8704725dbd160e7c799665706e0bdd";

  const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ];

  try {
    const factory = new ethers.Contract(PANCAKESWAP_FACTORY, FACTORY_ABI, provider);
    
    console.log("🔍 Checking if BNB-LEXA pair exists on PancakeSwap V2...\n");
    console.log(`Factory: ${PANCAKESWAP_FACTORY}`);
    console.log(`WBNB: ${WBNB}`);
    console.log(`LEXA: ${LEXA}\n`);
    
    const pair = await factory.getPair(WBNB, LEXA);
    
    if (pair === "0x0000000000000000000000000000000000000000") {
      console.log("❌ PAIR DOES NOT EXIST on PancakeSwap V2");
      console.log("\n   This is likely the root cause of your swap failure!");
      console.log("\n   Next steps:");
      console.log("   1. Verify LEXA token address: " + LEXA);
      console.log("   2. Check if LEXA is on a different DEX");
      console.log("   3. Visit https://pancakeswap.finance/swap");
      console.log("   4. Search for LEXA token to verify it exists");
    } else if (pair) {
      console.log(`✅ PAIR EXISTS on PancakeSwap V2`);
      console.log(`   Pair contract address: ${pair}`);
      console.log("\n   If pair exists but swaps fail, the issue is:");
      console.log("   1. LEXA transfer tax (5%) may be incompatible with router");
      console.log("   2. Token contract has restrictions blocking PancakeSwap");
      console.log("   3. Insufficient liquidity in the pair");
    } else {
      console.log("⚠️  Unexpected result from getPair:", pair);
    }
  } catch (error) {
    console.error("❌ Error:", error.message || error);
  }
}

checkPair();
