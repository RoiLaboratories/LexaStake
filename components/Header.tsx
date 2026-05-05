"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { LogOut } from "lucide-react";

const Header = () => {
  const router = useRouter();
  const { authenticated, user, login, logout } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);

  const getDisplayAddress = () => {
    if (!user) return "";
    
    if (user.wallet?.address) {
      const addr = user.wallet.address;
      return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    }
    
    if (user.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc) => "type" in acc && acc.type === "wallet"
      );
      if (walletAccount && "address" in walletAccount) {
        const addr = (walletAccount as { address: string }).address;
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      }
    }
    
    return "";
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header className="relative z-10 flex items-center justify-between px-6 sm:px-8 py-6 bg-transparent">
      <motion.div
        className="flex items-center gap-2 cursor-pointer"
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
        onClick={() => router.push("/")}
      >
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden">
          <Image
            src="/assets/LexaLogo2.svg"
            alt="Tower logo"
            width={40}
            height={40}
            className="object-contain"
          />
        </div>
        <span
          className="text-lg sm:text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          LEXASWAP
        </span>
      </motion.div>

      {authenticated ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            className="hidden sm:block px-4 sm:px-6 py-2 sm:py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all disabled:opacity-50"
          >
            {getDisplayAddress()}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDisconnect}
            disabled={isLoading}
            className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            aria-label="Disconnect wallet"
          >
            {isLoading ? (
              "..."
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleConnect}
          disabled={isLoading}
          className="px-6 py-2 sm:py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all disabled:opacity-50"
        >
          {isLoading ? "Connecting..." : "Connect wallet"}
        </motion.button>
      )}
    </header>
  );
};

export default Header;
