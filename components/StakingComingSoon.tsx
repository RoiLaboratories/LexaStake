"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import StakeHeader from "@/components/StakeHeader";
import { Lock, Zap, TrendingUp } from "lucide-react";

export default function StakingComingSoon() {
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Set launch date to 30 days from now
  useEffect(() => {
    const launchDate = new Date();
    launchDate.setDate(launchDate.getDate() + 30);

    const timer = setInterval(() => {
      const now = new Date();
      const difference = launchDate.getTime() - now.getTime();

      if (difference > 0) {
        setDays(Math.floor(difference / (1000 * 60 * 60 * 24)));
        setHours(Math.floor((difference / (1000 * 60 * 60)) % 24));
        setMinutes(Math.floor((difference / 1000 / 60) % 60));
        setSeconds(Math.floor((difference / 1000) % 60));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <StakeHeader showMenu={true} showConnectButton={true} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20 min-h-[calc(100vh-80px)]">
        <div className="max-w-4xl mx-auto w-full">
          {/* Coming Soon Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-12"
          >
            <div className="inline-block px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-6 sm:mb-8">
              <span className="text-sm sm:text-base font-semibold text-yellow-400">
                🚀 Coming Soon
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Earn Rewards by{" "}
              <span className="text-yellow-400">Staking</span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto mb-8 sm:mb-12">
              Multiple tiers, flexible terms, and competitive APY. Coming soon to LexaStake.
            </p>
          </motion.div>

          {/* Countdown Timer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-12 sm:mb-16"
          >
            {[
              { label: "Days", value: days },
              { label: "Hours", value: hours },
              { label: "Minutes", value: minutes },
              { label: "Seconds", value: seconds },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex flex-col items-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-yellow-500/5 to-yellow-500/0 border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300"
              >
                <span className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  {item.value.toString().padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-medium">
                  {item.label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16"
          >
            {[
              {
                icon: TrendingUp,
                title: "High Returns",
                description: "Up to 35% APY on your staked tokens",
              },
              {
                icon: Lock,
                title: "Secure",
                description: "Audited smart contracts and verified security",
              },
              {
                icon: Zap,
                title: "Flexible",
                description: "Choose 90-day or 180-day stake periods",
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-yellow-500/30 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/0 border border-yellow-500/20 rounded-xl p-8 sm:p-10 max-w-2xl mx-auto"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
              What to Expect
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {[
                "Multiple staking tiers (Bronze, Silver, Gold)",
                "Real-time reward tracking",
                "Transparent fee structure",
                "Instant claim functionality",
                "Referral bonuses up to 10%",
                "Mobile-optimized interface",
              ].map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3"
                >
                  <span className="text-yellow-400 font-bold mt-1 flex-shrink-0">
                    ✓
                  </span>
                  <span className="text-gray-300 text-sm sm:text-base">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="text-center mt-12 sm:mt-16"
          >
            <p className="text-gray-400 mb-4 text-sm sm:text-base">
              In the meantime, explore our other features
            </p>
            <motion.a
              href="/swap"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-yellow-500 text-black rounded-xl font-bold hover:bg-yellow-400 transition-all duration-300"
            >
              Visit Swap Page
            </motion.a>
          </motion.div>
        </div>
      </main>
    </>
  );
}
