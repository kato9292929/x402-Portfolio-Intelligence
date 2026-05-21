import { clamp01, isStablecoin, labelUnit, round } from "./util";

/**
 * Step 3 of the pipeline: the Divergence Analyzer.
 *
 * It compares the smart money score against broader market sentiment
 * (a Polymarket-style probability proxy) and reports how far the two have
 * diverged. A large positive gap means smart money is more bullish than the
 * crowd; a large negative gap means smart money is exiting ahead of price.
 */

export type DivergenceSignal =
  | "SMART_MONEY_BULLISH"
  | "SMART_MONEY_BEARISH"
  | "ALIGNED"
  | "NEUTRAL";

export interface Divergence {
  divergenceScore: number;
  signal: DivergenceSignal;
  marketSentiment: number;
}

export function analyzeDivergence(token: string, smartMoneyScore: number): Divergence {
  const marketSentiment = clamp01(0.2 + labelUnit(`market-sentiment:${token.toUpperCase()}`) * 0.6);
  const gap = smartMoneyScore - marketSentiment;
  const divergenceScore = round(clamp01(Math.abs(gap) * 1.45), 2);

  let signal: DivergenceSignal;
  if (gap > 0.18) signal = "SMART_MONEY_BULLISH";
  else if (gap < -0.18) signal = "SMART_MONEY_BEARISH";
  else if (divergenceScore < 0.15) signal = "ALIGNED";
  else signal = "NEUTRAL";

  return { divergenceScore, signal, marketSentiment: round(marketSentiment, 2) };
}

/** Per-token volatility proxy — stablecoins are pinned low. */
export function tokenVolatility(token: string): number {
  if (isStablecoin(token)) return 0.05;
  return clamp01(0.3 + labelUnit(`volatility:${token.toUpperCase()}`) * 0.6);
}

/**
 * Blended position risk score in [0, 1]: weighted from volatility,
 * how far smart money has diverged, and weak smart money conviction.
 */
export function tokenRiskScore(
  token: string,
  smartMoneyScore: number,
  divergenceScore: number,
): number {
  const volatility = tokenVolatility(token);
  return round(
    clamp01(0.45 * volatility + 0.35 * divergenceScore + 0.2 * (1 - smartMoneyScore)),
    2,
  );
}

/** Rough annualised expected return proxy in [-1, 1]. */
export function tokenExpectedReturn(
  smartMoneyScore: number,
  divergenceScore: number,
  signal: DivergenceSignal,
): number {
  const directional = signal === "SMART_MONEY_BEARISH" ? -1 : signal === "SMART_MONEY_BULLISH" ? 1 : 0.3;
  const base = (smartMoneyScore - 0.5) * 0.6;
  return round(Math.max(-0.6, Math.min(0.9, base + directional * divergenceScore * 0.35)), 3);
}
