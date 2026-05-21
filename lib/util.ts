/** Shared deterministic helpers used by the analysis engine. */

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** FNV-1a string hash — stable across runs so demo output is reproducible. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Maps a seed to a deterministic value in [0, 1). */
export function seededUnit(seed: number): number {
  let s = seed >>> 0;
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  s ^= s >>> 15;
  return (s >>> 0) / 4294967296;
}

/** Deterministic [0, 1) value derived from an arbitrary label. */
export function labelUnit(label: string): number {
  return seededUnit(hashString(label));
}

export const STABLECOINS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "USDE",
  "PYUSD",
  "USDC.E",
  "FDUSD",
]);

export function isStablecoin(token: string): boolean {
  return STABLECOINS.has(token.toUpperCase());
}
