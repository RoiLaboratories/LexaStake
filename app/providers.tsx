"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7bb8ff",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
