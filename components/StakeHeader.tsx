"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface StakeHeaderProps {
  showMenu?: boolean;
  showConnectButton?: boolean;
  walletAddress?: string | null;
  onConnect?: () => void;
}

const StakeHeader = ({
  showMenu = false,
  showConnectButton = false,
  walletAddress = null,
  onConnect,
}: StakeHeaderProps) => {
  const router = useRouter();
  const menuItems = showMenu ? ["Stake", "Swap", "Earn", "Profile"] : [];
  const [activeTab, setActiveTab] = useState("Stake");

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-6 bg-transparent">
      <motion.div
        className="flex items-center gap-2 cursor-pointer"
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
        onClick={() => router.push("/stake")}
      >
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden">
          <Image
            src="/assets/LexaLogo2.svg"
            alt="Lexa logo"
            width={40}
            height={40}
            className="object-contain"
          />
        </div>
        <span
          className="text-lg sm:text-xl font-bold text-white"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          LEXASTAKE
        </span>
      </motion.div>

      {showMenu && (
        <nav className="flex gap-8">
          {menuItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`text-lg font-semibold transition-colors relative ${
                activeTab === item ? "text-yellow-500" : "text-white"
              }`}
            >
              {item}
              {activeTab === item && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-2 left-0 right-0 h-1 bg-yellow-500"
                />
              )}
            </button>
          ))}
        </nav>
      )}

      {showConnectButton && (
        <button
          onClick={onConnect}
          className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all"
        >
          {walletAddress ? formatAddress(walletAddress) : "Connect wallet"}
        </button>
      )}
    </header>
  );
};

export default StakeHeader;
