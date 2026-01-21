"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/Header";

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 lg:pb-20 min-h-[calc(100vh-200px)]">
        <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight px-2"
          >
            <span className="text-yellow-500">Secure</span> Your Crypto Future
            With <span className="block mt-2 text-yellow-500">Lexastake</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-2"
          >
            Earn up to 35% ROI with our tiered staking system. Flexible lock
            periods, competitive rewards, and complete transparency.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="pt-4 sm:pt-6"
          >
            <button
              onClick={() => router.push("/stake")}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-2 bg-transparent border-2 border-yellow-500 text-yellow-500 rounded-md font-semibold text-base sm:text-lg hover:bg-yellow-500 hover:text-black transition-all duration-300 transform hover:scale-105 cursor-pointer"
            >
              Get started
            </button>
          </motion.div>
        </div>
      </main>
    </>
  );
}
