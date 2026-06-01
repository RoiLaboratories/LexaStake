// ==========================================
// SWAP DEBUGGING UTILITY
// Paste this in browser console to help diagnose issues
// ==========================================

window.swapDebug = {
  // Check wallet connection
  checkWallet: function() {
    console.clear();
    console.log("🔍 WALLET CHECK");
    console.log("================");
    
    if (!window.ethereum) {
      console.error("❌ window.ethereum not found!");
      console.log("   This means Privy or wallet extension is not configured");
      return;
    }
    
    console.log("✓ window.ethereum available");
    console.log("  Provider:", window.ethereum.constructor.name);
    console.log("  Chain ID:", window.ethereum.chainId);
    console.log("  IsConnected:", window.ethereum.isConnected?.());
    console.log("  Selected address:", window.ethereum.selectedAddress);
  },
  
  // Test provider connection
  testProvider: async function() {
    console.clear();
    console.log("🔍 PROVIDER TEST");
    console.log("================");
    
    try {
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      console.log("✓ BrowserProvider created");
      
      const network = await provider.getNetwork();
      console.log("✓ Network fetched:", network.name, "(ChainId:", network.chainId, ")");
      
      if (network.chainId === 56n) {
        console.log("✓ Correct chain (BSC MainNet)");
      } else {
        console.error("❌ Wrong chain! Need 56, got", network.chainId);
      }
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      console.log("✓ Signer address:", address);
      
      return { provider, network, address };
    } catch (error) {
      console.error("❌ Error:", error.message);
      return null;
    }
  },
  
  // Check balances
  checkBalances: async function() {
    console.clear();
    console.log("💰 BALANCE CHECK");
    console.log("================");
    
    try {
      const debug = await this.testProvider();
      if (!debug) return;
      
      const { BrowserProvider, Contract, formatEther } = await import('ethers');
      const provider = debug.provider;
      const address = debug.address;
      
      // Check BNB balance
      const bnbBalance = await provider.getBalance(address);
      console.log("✓ BNB Balance:", formatEther(bnbBalance), "BNB");
      
      // Check LEXA balance
      const LEXA_ADDRESS = "0x6fc20e595A8704725DBd160E7c799665706e0bdD";
      const ERC20_ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
      ];
      
      const lexaContract = new Contract(LEXA_ADDRESS, ERC20_ABI, provider);
      const lexaBalance = await lexaContract.balanceOf(address);
      const decimals = await lexaContract.decimals();
      
      const lexaFormatted = formatEther(lexaBalance, decimals);
      console.log("✓ LEXA Balance:", lexaFormatted, "LEXA");
      
      return { bnbBalance, lexaBalance };
    } catch (error) {
      console.error("❌ Error:", error.message);
      return null;
    }
  },
  
  // Test quote API
  testQuoteAPI: async function(amountIn = "1") {
    console.clear();
    console.log("📊 API QUOTE TEST");
    console.log("================");
    console.log("Testing swap of", amountIn, "BNB -> LEXA");
    
    try {
      const debug = await this.testProvider();
      if (!debug) return;
      
      const payload = {
        tokenIn: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
        tokenOut: "0x6fc20e595A8704725DBd160E7c799665706e0bdD", // LEXA
        amountIn,
        slippage: 1,
        walletAddress: debug.address
      };
      
      console.log("📤 Sending to /api/pancakeswap/prepare-swap");
      console.log("   Payload:", payload);
      
      const response = await fetch("/api/pancakeswap/prepare-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      console.log("📬 Response status:", response.status);
      
      const data = await response.json();
      
      if (response.ok) {
        console.log("✓ Quote received:");
        console.log("  Amount In:", data.details.amountIn);
        console.log("  Amount Out:", data.details.amountOut);
        console.log("  Min Amount Out:", data.details.minimumAmountOut);
        console.log("  Router: ", data.swap.to);
        console.log("  Has Approval:", data.approval ? "yes" : "no");
        return data;
      } else {
        console.error("❌ API Error:", data.error);
        return null;
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
      return null;
    }
  },
  
  // Run all diagnostics
  runAll: async function() {
    console.clear();
    console.log("🔍 FULL DIAGNOSTIC SUITE");
    console.log("=========================\n");
    
    console.log("1️⃣  WALLET CHECK");
    console.log("-----------------");
    this.checkWallet();
    
    console.log("\n2️⃣  PROVIDER TEST");
    console.log("-----------------");
    await this.testProvider();
    
    console.log("\n3️⃣  BALANCE CHECK");
    console.log("-----------------");
    await this.checkBalances();
    
    console.log("\n4️⃣  API QUOTE TEST");
    console.log("-----------------");
    await this.testQuoteAPI("0.01");
    
    console.log("\n✅ Diagnostic Complete!\n");
  }
};

console.log(`
╔════════════════════════════════════════════════════╗
║        SWAP DEBUGGING UTILITY LOADED ✓             ║
║                                                    ║
║ Available commands:                                ║
║   swapDebug.checkWallet()     - Check provider    ║
║   swapDebug.testProvider()    - Test ethers       ║
║   swapDebug.checkBalances()   - Check BNB/LEXA    ║
║   swapDebug.testQuoteAPI()    - Test API call     ║
║   swapDebug.runAll()          - Run all tests     ║
║                                                    ║
║ Start with: swapDebug.runAll()                     ║
╚════════════════════════════════════════════════════╝
`);
