"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { base, mainnet } from "wagmi/chains";

// Solana wallet context is browser-only (wallet adapters touch window/indexedDB).
const SolanaWalletProviders = dynamic(
  () => import("@/components/SolanaWalletProviders"),
  { ssr: false },
);

const wagmiConfig = getDefaultConfig({
  appName: "x402 Portfolio Intelligence",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder",
  chains: [base, mainnet],
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#c8a96e",
            accentColorForeground: "#0a0a0a",
            borderRadius: "small",
            overlayBlur: "small",
          })}
        >
          <SolanaWalletProviders>{children}</SolanaWalletProviders>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
