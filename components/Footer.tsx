"use client";
import { FaXTwitter, FaTelegram, FaYoutube } from "react-icons/fa6";
import { motion } from "framer-motion";
import Image from "next/image";

const Footer = () => {
  const socialLinks = [
    {
      icon: <FaXTwitter className="w-5 h-5" />,
      href: "https://x.com/",
    },
    {
      icon: <FaTelegram className="w-5 h-5" />,
      href: "https://web.telegram.org/",
    },
    {
      icon: <FaYoutube className="w-5 h-5" />,
      href: "https://youtube.com/",
    },
  ];

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="relative z-10 flex items-center justify-between px-8 py-6 border-t border-gray-800 bg-black"
    >
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Image
          src="/assets/LexaLogo2.svg"
          alt="Tower logo"
          width={40}
          height={40}
          className="object-contain"
        />
        <span>Lexastake 2026</span>
      </div>

      <div className="flex items-center gap-4">
        {socialLinks.map((link, index) => (
          <motion.a
            key={index}
            href={link.href}
            className="text-green-500 hover:text-green-400 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.2, y: -2 }}
            whileTap={{ scale: 0.9 }}
          >
            {link.icon}
          </motion.a>
        ))}
      </div>
    </motion.footer>
  );
};

export default Footer;
