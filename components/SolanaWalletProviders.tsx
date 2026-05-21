"use client";

import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Buffer } from "buffer";
import { useMemo, type ReactNode } from "react";

// @solana/web3.js expects a global Buffer, which browsers do not provide.
const globalScope = globalThis as typeof globalThis & { Buffer?: unknown };
if (typeof window !== "undefined" && globalScope.Buffer === undefined) {
  globalScope.Buffer = Buffer;
}

/**
 * Solana wallet context (Phantom + Solflare only).
 * Imported via next/dynamic with ssr:false from app/providers.tsx.
 */
export default function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  );
}
