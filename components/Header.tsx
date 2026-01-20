"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";

const Header = () => {
  const router = useRouter();
  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-6 bg-transparent">
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
          LEXASTAKE
        </span>
      </motion.div>
    </header>
  );
};

export default Header;
