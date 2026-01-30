import Image from "next/image";
import { Token } from "@/types/swap.types";

interface TokenIconProps {
  token: Token;
  size?: number;
}

export default function TokenIcon({ token, size = 20 }: TokenIconProps) {
  return (
    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
      <Image
        src={token.logoPath}
        alt={token.symbol}
        width={size}
        height={size}
      />
    </div>
  );
}
