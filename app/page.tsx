"use client";
import { useRouter } from "next/navigation";
import Header from "@/components/Header"; // Adjust the path based on your file structure

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20 min-h-[calc(100vh-200px)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
            <span className="text-yellow-500">Secure</span> Your Crypto Future
            With <span className="block mt-2">Lexastake</span>
          </h1>

          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">
            Earn up to 35% ROI with our tiered staking system. Flexible lock
            periods, competitive rewards, and complete transparency.
          </p>

          <div className="pt-6">
            <button
              onClick={() => router.push("/stake")}
              className="px-8 py-4 bg-transparent border-2 border-yellow-500 text-yellow-500 rounded-lg font-semibold text-lg hover:bg-yellow-500 hover:text-black transition-all duration-300 transform hover:scale-105 cursor-pointer"
            >
              Get started
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
