/** Shared multi-chain payment configuration for the UI and x402 client. */

export type PaymentChain = "solana" | "base" | "polygon" | "bnb";
export type PaymentToken = "USDC" | "JPYC" | "USDT";
export type Feature = "analyze" | "history" | "simulate";

export interface ChainTokenOption {
  token: PaymentToken;
  enabled: boolean;
}

export const PAYMENT_CHAINS: { id: PaymentChain; label: string }[] = [
  { id: "solana", label: "Solana" },
  { id: "base", label: "Base" },
  { id: "polygon", label: "Polygon" },
  { id: "bnb", label: "BNB Chain" },
];

/** Tokens offered per chain. Disabled tokens render greyed-out. */
export const CHAIN_TOKENS: Record<PaymentChain, ChainTokenOption[]> = {
  solana: [
    { token: "USDC", enabled: true },
    { token: "JPYC", enabled: false },
  ],
  base: [{ token: "USDC", enabled: true }],
  polygon: [
    { token: "USDC", enabled: true },
    { token: "JPYC", enabled: true },
  ],
  bnb: [{ token: "USDT", enabled: true }],
};

export const CHAIN_BANNER: Partial<Record<PaymentChain, string>> = {
  solana: "SolanaネットワークではUSDC決済のみご利用いただけます",
  bnb: "BNB ChainではUSDT決済のみご利用いただけます",
};

/** First selectable token for a chain. */
export function defaultToken(chain: PaymentChain): PaymentToken {
  return (CHAIN_TOKENS[chain].find((t) => t.enabled) ?? CHAIN_TOKENS[chain][0]).token;
}

/** Resolves the API endpoint for a feature given the chosen payment chain / token. */
export function paymentEndpoint(
  feature: Feature,
  chain: PaymentChain,
  token: PaymentToken,
): string {
  const root = `/api/portfolio/${feature}`;
  if (chain === "base") return root; // existing Base USDC route
  const sub = `${root}/${chain}`;
  if (chain === "polygon" && token === "JPYC") return `${sub}?token=jpyc`;
  return sub;
}

/** Portfolio chain understood by the analysis engine (BNB has no engine support). */
export function analyzedChainFor(chain: PaymentChain): "solana" | "base" | "polygon" {
  return chain === "bnb" ? "base" : chain;
}

export function isSolanaChain(chain: PaymentChain): boolean {
  return chain === "solana";
}
