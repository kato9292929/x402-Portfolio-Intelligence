import type { Chain, TokenHolding } from "./types";
import { hashString, seededUnit } from "./util";

/**
 * Step 1 of the pipeline: resolve a wallet's token holdings.
 *
 * Solana goes through the Helius DAS API; Base / Polygon go through the
 * Alchemy data API. When a provider key is missing or the call fails we fall
 * back to a deterministic simulated portfolio so the product stays demoable.
 */

const TOKEN_UNIVERSE: Record<Chain, string[]> = {
  solana: ["SOL", "JUP", "JTO", "JLP", "BONK", "WIF", "PYTH", "RAY", "USDC"],
  base: ["ETH", "cbBTC", "AERO", "DEGEN", "BRETT", "MORPHO", "WELL", "USDC"],
  polygon: ["MATIC", "WETH", "WBTC", "AAVE", "LINK", "UNI", "USDC", "USDT"],
};

export interface PortfolioFetchResult {
  holdings: TokenHolding[];
  source: "live" | "simulated";
}

export async function fetchWalletPortfolio(
  walletAddress: string,
  chain: Chain,
): Promise<PortfolioFetchResult> {
  try {
    const holdings =
      chain === "solana"
        ? await fetchSolanaHoldings(walletAddress)
        : await fetchEvmHoldings(walletAddress, chain);
    if (holdings.length > 0) {
      return { holdings: normalize(holdings), source: "live" };
    }
  } catch {
    // fall through to the simulated portfolio
  }
  return { holdings: simulatePortfolio(walletAddress, chain), source: "simulated" };
}

function normalize(holdings: TokenHolding[]): TokenHolding[] {
  const merged = new Map<string, number>();
  for (const h of holdings) {
    if (!h.token || !Number.isFinite(h.valueUsd) || h.valueUsd <= 0) continue;
    const key = h.token.toUpperCase();
    merged.set(key, (merged.get(key) ?? 0) + h.valueUsd);
  }
  return [...merged.entries()]
    .map(([token, valueUsd]) => ({ token, valueUsd }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 8);
}

async function fetchSolanaHoldings(walletAddress: string): Promise<TokenHolding[]> {
  const rpc = process.env.HELIUS_RPC_URL;
  if (!rpc || rpc.includes("YOUR_KEY")) throw new Error("HELIUS_RPC_URL not configured");

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "portfolio-intelligence",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: walletAddress,
        page: 1,
        limit: 1000,
        displayOptions: { showFungible: true, showNativeBalance: true },
      },
    }),
  });
  if (!res.ok) throw new Error(`Helius responded ${res.status}`);
  const json = await res.json();

  const holdings: TokenHolding[] = [];
  for (const item of json?.result?.items ?? []) {
    if (item?.interface !== "FungibleToken" && item?.interface !== "FungibleAsset") continue;
    const value = item?.token_info?.price_info?.total_price;
    const symbol = item?.token_info?.symbol ?? item?.content?.metadata?.symbol;
    if (typeof value === "number" && symbol) holdings.push({ token: symbol, valueUsd: value });
  }

  const native = json?.result?.nativeBalance;
  if (native?.lamports && native?.price_per_sol) {
    holdings.push({
      token: "SOL",
      valueUsd: (native.lamports / 1e9) * native.price_per_sol,
    });
  }
  return holdings;
}

async function fetchEvmHoldings(
  walletAddress: string,
  chain: Exclude<Chain, "solana">,
): Promise<TokenHolding[]> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not configured");

  const network = chain === "base" ? "base-mainnet" : "polygon-mainnet";
  const res = await fetch(`https://api.g.alchemy.com/data/v1/${key}/assets/tokens/by-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [{ address: walletAddress, networks: [network] }],
      withMetadata: true,
      withPrices: true,
    }),
  });
  if (!res.ok) throw new Error(`Alchemy responded ${res.status}`);
  const json = await res.json();

  const holdings: TokenHolding[] = [];
  for (const token of json?.data?.tokens ?? []) {
    const decimals = Number(token?.tokenMetadata?.decimals ?? 18);
    const symbol = token?.tokenMetadata?.symbol;
    const price = Number(token?.tokenPrices?.[0]?.value ?? 0);
    let balance = 0;
    try {
      balance = Number(BigInt(token?.tokenBalance ?? "0x0")) / 10 ** decimals;
    } catch {
      balance = 0;
    }
    if (symbol && price > 0 && balance > 0) {
      holdings.push({ token: symbol, valueUsd: balance * price });
    }
  }
  return holdings;
}

/** Deterministic portfolio derived from the wallet address — no network needed. */
function simulatePortfolio(walletAddress: string, chain: Chain): TokenHolding[] {
  const universe = TOKEN_UNIVERSE[chain];
  const base = hashString(`${walletAddress.toLowerCase()}:${chain}`);
  const count = 3 + (base % 4);

  const holdings: TokenHolding[] = [];
  for (let i = 0; i < count + 2 && holdings.length < count; i++) {
    const tokenSeed = seededUnit(base + i * 7919);
    const token = universe[Math.floor(tokenSeed * universe.length)];
    if (holdings.some((h) => h.token === token)) continue;
    const valueUsd = 1800 + seededUnit(base + i * 104729) * 27000;
    holdings.push({ token, valueUsd });
  }
  if (holdings.length === 0) holdings.push({ token: universe[0], valueUsd: 12000 });
  return normalize(holdings);
}
