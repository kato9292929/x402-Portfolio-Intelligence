/** Shared x402 v2 payment configuration for the UI and the browser client. */

export type PaymentChain = "base" | "solana";

export const PAYMENT_CHAINS: { id: PaymentChain; label: string }[] = [
  { id: "base", label: "Base" },
  { id: "solana", label: "Solana" },
];

/** CAIP-2 network identifier advertised by the server for each payment chain. */
export const NETWORK_FOR: Record<PaymentChain, string> = {
  base: "eip155:8453",
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

export function isSolanaChain(chain: PaymentChain): boolean {
  return chain === "solana";
}

/** Portfolio chain understood by the analysis engine. */
export function analyzedChainFor(chain: PaymentChain): "solana" | "base" | "polygon" {
  return chain;
}
