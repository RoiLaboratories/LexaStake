const { ethers } = require("ethers");

async function checkRouters() {
  const rpc = "https://bsc.meowrpc.com";
  const provider = new ethers.JsonRpcProvider(rpc);

  const ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const UNIVERSAL_ROUTER = "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB"; // ✅ Correct address

  console.log("🔍 CHECKING PANCAKESWAP ROUTERS\n");
  
  console.log("Router V2 (Old - DEPRECATED):");
  console.log(`  Address: ${ROUTER_V2}`);
  console.log(`  Status: No longer used\n`);
  
  console.log("Universal Router V2 (Current - ACTIVE):");
  console.log(`  Address: ${UNIVERSAL_ROUTER}`);
  console.log(`  Type: Modern router used by PancakeSwap v4+\n`);
  
  // Try to get code to verify they exist
  const v2Code = await provider.getCode(ROUTER_V2);
  const urCode = await provider.getCode(UNIVERSAL_ROUTER);
  
  console.log("✓ Router V2 exists:", v2Code.length > 2 ? "YES" : "NO");
  console.log("✓ Universal Router exists:", urCode.length > 2 ? "YES" : "NO");
  
  console.log("\n📋 RECOMMENDATION:");
  console.log("The successful PancakeSwap transaction used Universal Router.");
  console.log("We're using Router V2 which may have compatibility issues.");
  console.log("\nOptions:");
  console.log("1. Switch to Universal Router (requires new ABI)");
  console.log("2. Check if Router V2 address changed");
  console.log("3. Verify transaction data encoding for Router V2");
}

checkRouters();
