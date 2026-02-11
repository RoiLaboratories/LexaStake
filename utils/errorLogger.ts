/**
 * Comprehensive error logging utility for debugging transaction failures
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  walletAddress?: string;
  chainId?: string;
  timestamp?: string;
  additionalInfo?: Record<string, any>;
}

export const errorLogger = {
  /**
   * Log an error with full context
   */
  logError(error: any, context: ErrorContext = {}) {
    const timestamp = new Date().toISOString();
    const component = context.component || "UNKNOWN";
    const action = context.action || "UNKNOWN_ACTION";

    console.group(`❌ ERROR [${component}] ${action}`);
    console.log(`⏱️  Timestamp: ${context.timestamp || timestamp}`);
    
    if (context.walletAddress) {
      console.log(`📱 Wallet: ${context.walletAddress.slice(0, 6)}...${context.walletAddress.slice(-4)}`);
    }
    
    if (context.chainId) {
      console.log(`🌐 Chain: ${context.chainId}`);
    }

    // Log the main error message
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
      console.error("Error Name:", error.name);
    } else if (typeof error === "string") {
      console.error("Error Message:", error);
    } else {
      console.error("Error Object:", error);
    }

    // Log additional details
    if (error && typeof error === "object") {
      const err = error as any;
      
      if (err.code) console.error("Error Code:", err.code);
      if (err.reason) console.error("Error Reason:", err.reason);
      if (err.info) console.error("Error Info:", err.info);
      if (err.data) console.error("Error Data:", err.data);
      if (err.error) {
        console.error("Nested Error:", err.error);
        if (err.error.message) console.error("Nested Error Message:", err.error.message);
      }
      
      // Check for transaction-related fields
      if (err.transaction) console.error("Transaction:", err.transaction);
      if (err.receipt) console.error("Receipt:", err.receipt);
      if (err.transactionHash) console.error("TX Hash:", err.transactionHash);
    }

    // Log additional context
    if (context.additionalInfo && Object.keys(context.additionalInfo).length > 0) {
      console.log("Additional Context:", context.additionalInfo);
    }

    console.groupEnd();
  },

  /**
   * Log wallet request/response
   */
  logWalletRequest(method: string, params: any[], context: ErrorContext = {}) {
    console.log(`📡 [WALLET_RPC] ${method}`, params);
  },

  /**
   * Log wallet response
   */
  logWalletResponse(method: string, result: any, context: ErrorContext = {}) {
    console.log(`✓ [WALLET_RPC] ${method} response:`, result);
  },

  /**
   * Log transaction lifecycle event
   */
  logTransactionEvent(
    event: "sent" | "confirmed" | "failed" | "rejected" | "timeout",
    txHash: string,
    context: ErrorContext = {}
  ) {
    const icons: Record<string, string> = {
      sent: "📤",
      confirmed: "✓",
      failed: "❌",
      rejected: "🚫",
      timeout: "⏱️ ",
    };

    const icon = icons[event] || "📊";
    console.log(`${icon} [TRANSACTION] ${event.toUpperCase()}: ${txHash}`);
    
    if (context.additionalInfo) {
      console.log("  Details:", context.additionalInfo);
    }
  },

  /**
   * Log a warning
   */
  logWarning(message: string, context: ErrorContext = {}) {
    const component = context.component || "UNKNOWN";
    console.warn(`⚠️  [${component}] ${message}`, context.additionalInfo || {});
  },

  /**
   * Create a bounded error display for the UI
   */
  formatErrorForDisplay(error: any, maxLength: number = 150): string {
    let message = "";

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else if (error?.message) {
      message = error.message;
    } else {
      message = JSON.stringify(error);
    }

    // Clean up common prefixes
    message = message
      .replace(/^Error: /, "")
      .replace(/^(Unknown error|Failed to)/i, "")
      .trim();

    // Truncate if too long
    if (message.length > maxLength) {
      message = message.substring(0, maxLength) + "... (See console for full details)";
    }

    return message;
  },
};
