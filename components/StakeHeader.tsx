"use client";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

interface StakeHeaderProps {
  showMenu?: boolean;
  showConnectButton?: boolean;
  activeTab?: string;
}

const StakeHeader = ({
  showMenu = true,
  showConnectButton = true,
  activeTab: initialActiveTab = "Stake",
}: StakeHeaderProps) => {
  const router = useRouter();
  const { authenticated, user, login, logout } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const menuItems = showMenu ? ["Swap", "Earn", "Profile"] : [];
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getDisplayAddress = () => {
    if (!user) return "";

    if (user.wallet?.address) {
      const addr = user.wallet.address;
      return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    }

    if (user.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc) => "type" in acc && acc.type === "wallet",
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

  const handleMenuClick = (item: string) => {
    setActiveTab(item);
    setMobileMenuOpen(false);

    // Navigate to the appropriate page
    switch (item) {
      case "Stake":
        router.push("/stake");
        break;
      case "Swap":
        router.push("/swap");
        break;
      case "Earn":
        router.push("/earn");
        break;
      case "Profile":
        router.push("/profile");
        break;
      default:
        break;
    }
  };

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 bg-transparent">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-2 cursor-pointer"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
          onClick={() => router.push("/")}
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
            LEXASWAP
          </span>
        </motion.div>

        {/* Desktop Navigation */}
        {showMenu && (
          <nav className="hidden md:flex gap-8">
            {menuItems.map((item) => (
              <button
                key={item}
                onClick={() => handleMenuClick(item)}
                className={`text-lg font-semibold transition-colors relative cursor-pointer ${
                  activeTab === item
                    ? "text-yellow-500"
                    : "text-white hover:text-gray-300"
                }`}
              >
                {item}
                {activeTab === item && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-2 left-0 right-0 h-1 bg-yellow-500 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connect/Wallet Button */}
          {showConnectButton && (
            <>
              {authenticated ? (
                <>
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
                    className="block sm:hidden p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                    aria-label="Disconnect wallet"
                  >
                    {isLoading ? "..." : <LogOut className="w-4 h-4" />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="hidden sm:block p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                    aria-label="Disconnect wallet"
                  >
                    {isLoading ? "..." : <LogOut className="w-4 h-4" />}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="hidden sm:block px-4 sm:px-6 py-2 sm:py-3 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Connect wallet"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="block sm:hidden px-3 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold hover:bg-yellow-400 transition-all disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Connect"}
                  </motion.button>
                </>
              )}
            </>
          )}

          {/* Mobile Menu Button */}
          {showMenu && (
            <motion.button
              className="md:hidden p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </motion.button>
          )}
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && showMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden border-b border-yellow-600/30  backdrop-blur-sm overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-2">
              {menuItems.map((item, index) => (
                <motion.button
                  key={item}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleMenuClick(item)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-base font-semibold transition-colors ${
                    activeTab === item
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "text-white hover:text-yellow-500 hover:bg-gray-800/50"
                  }`}
                >
                  {item}
                </motion.button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StakeHeader;
