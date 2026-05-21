import type { Chain } from "./types";
import { clamp01, labelUnit } from "./util";

/**
 * Step 2 of the pipeline: a Nansen-style smart money score per token.
 *
 * The score is in [0, 1] where higher means smart money wallets are net
 * accumulating the token. When NANSEN_API_KEY is absent we synthesise a
 * deterministic score so the rest of the pipeline still has signal.
 */

export async function fetchSmartMoneyScore(token: string, chain: Chain): Promise<number> {
  const key = process.env.NANSEN_API_KEY;
  if (!key) return simulatedScore(token);

  try {
    const res = await fetch("https://api.nansen.ai/v1/smart-money/token-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json", apiKey: key },
      body: JSON.stringify({ token, chain }),
    });
    if (!res.ok) return simulatedScore(token);

    const json = await res.json();
    const raw = json?.smartMoneyScore ?? json?.data?.score ?? json?.score;
    if (typeof raw !== "number") return simulatedScore(token);
    return clamp01(raw > 1 ? raw / 100 : raw);
  } catch {
    return simulatedScore(token);
  }
}

export async function fetchSmartMoneyScores(
  tokens: string[],
  chain: Chain,
): Promise<Record<string, number>> {
  const scores = await Promise.all(tokens.map((t) => fetchSmartMoneyScore(t, chain)));
  const out: Record<string, number> = {};
  tokens.forEach((token, i) => {
    out[token] = scores[i];
  });
  return out;
}

/** Deterministic smart money score — exported for offline recomputation. */
export function simulatedScore(token: string): number {
  return clamp01(0.28 + labelUnit(`smart-money:${token.toUpperCase()}`) * 0.62);
}
