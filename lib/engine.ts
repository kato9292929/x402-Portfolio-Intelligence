import { callClaude, extractJson } from "./claude";
import { analyzeDivergence, tokenExpectedReturn, tokenRiskScore } from "./divergence";
import { fetchSmartMoneyScores, simulatedScore } from "./nansen";
import { fetchWalletPortfolio } from "./portfolio";
import type {
  Chain,
  HistoryAnalysis,
  HistoryPoint,
  Position,
  Recommendation,
  RecommendationAction,
  RiskTolerance,
  PortfolioAnalysis,
  SimulationMetrics,
  SimulationResult,
} from "./types";
import { clamp01, hashString, round, seededUnit } from "./util";

const ACTIONS = new Set<RecommendationAction>(["REDUCE", "INCREASE", "HOLD", "EXIT"]);

/* ----------------------------- portfolio analysis ----------------------------- */

export async function analyzePortfolio(
  walletAddress: string,
  chain: Chain,
  riskTolerance: RiskTolerance,
): Promise<PortfolioAnalysis> {
  const { holdings, source } = await fetchWalletPortfolio(walletAddress, chain);
  const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0) || 1;

  const smartMoney = await fetchSmartMoneyScores(
    holdings.map((h) => h.token),
    chain,
  );

  const positions: Position[] = holdings.map((h) => {
    const smartMoneyScore = round(smartMoney[h.token] ?? simulatedScore(h.token), 2);
    const { divergenceScore } = analyzeDivergence(h.token, smartMoneyScore);
    return {
      token: h.token,
      valueUsd: round(h.valueUsd, 2),
      allocation: round(h.valueUsd / totalValueUsd, 4),
      smartMoneyScore,
      divergenceScore,
      riskScore: tokenRiskScore(h.token, smartMoneyScore, divergenceScore),
    };
  });

  const overallRisk = round(weighted(positions, (p) => p.riskScore), 2);
  const smartMoneyAlignment = round(weighted(positions, (p) => p.smartMoneyScore), 2);

  const ai = await generateRecommendations(
    walletAddress,
    chain,
    riskTolerance,
    positions,
    overallRisk,
    smartMoneyAlignment,
  );

  return {
    walletAddress,
    chain,
    riskTolerance,
    analyzedAt: new Date().toISOString(),
    dataSource: source,
    portfolio: { totalValueUsd: round(totalValueUsd, 2), positions },
    analysis: {
      overallRisk,
      smartMoneyAlignment,
      recommendations: ai.recommendations,
      summary_ja: ai.summary_ja,
      confidence: ai.confidence,
    },
  };
}

interface AiResult {
  recommendations: Recommendation[];
  summary_ja: string;
  confidence: number;
}

async function generateRecommendations(
  walletAddress: string,
  chain: Chain,
  riskTolerance: RiskTolerance,
  positions: Position[],
  overallRisk: number,
  smartMoneyAlignment: number,
): Promise<AiResult> {
  const fallback = ruleBasedRecommendations(positions, riskTolerance, overallRisk, smartMoneyAlignment);

  const system =
    "あなたはオンチェーンのスマートマネーシグナルを専門とするDeFiポートフォリオアナリストです。" +
    "リスク・流動性・スマートマネーの蓄積/離脱を踏まえ、簡潔で実用的なリバランス提案を日本語で行います。" +
    "出力は必ず指定されたJSONのみとし、投資助言ではなく情報提供である前提で書いてください。";

  const user = [
    `ウォレット: ${walletAddress}`,
    `チェーン: ${chain} / リスク許容度: ${riskTolerance}`,
    `総合リスク: ${overallRisk} / スマートマネー整合: ${smartMoneyAlignment}`,
    "ポジション:",
    JSON.stringify(positions, null, 2),
    "",
    "次の形式のJSONのみを返してください:",
    '{"recommendations":[{"action":"REDUCE|INCREASE|HOLD|EXIT","token":"SOL","reason":"日本語の理由","targetAllocation":0.3}],"summary_ja":"3〜4文の総括","confidence":0.0}',
  ].join("\n");

  const parsed = extractJson<{
    recommendations?: unknown;
    summary_ja?: unknown;
    confidence?: unknown;
  }>(await callClaude(system, user));
  if (!parsed) return fallback;

  const tokens = new Set(positions.map((p) => p.token));
  const recommendations: Recommendation[] = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .map((r) => r as Record<string, unknown>)
        .filter((r) => ACTIONS.has(r.action as RecommendationAction) && typeof r.token === "string")
        .map((r) => ({
          action: r.action as RecommendationAction,
          token: r.token as string,
          reason: typeof r.reason === "string" ? r.reason : "—",
          targetAllocation: clamp01(Number(r.targetAllocation) || 0),
        }))
        .filter((r) => tokens.has(r.token))
    : [];

  if (recommendations.length === 0) return fallback;

  return {
    recommendations,
    summary_ja:
      typeof parsed.summary_ja === "string" && parsed.summary_ja.trim().length > 0
        ? parsed.summary_ja.trim()
        : fallback.summary_ja,
    confidence:
      typeof parsed.confidence === "number"
        ? round(clamp01(parsed.confidence), 2)
        : fallback.confidence,
  };
}

function ruleBasedRecommendations(
  positions: Position[],
  riskTolerance: RiskTolerance,
  overallRisk: number,
  smartMoneyAlignment: number,
): AiResult {
  const cap = riskTolerance === "LOW" ? 0.3 : riskTolerance === "MEDIUM" ? 0.42 : 0.55;

  const recommendations: Recommendation[] = positions.map((p) => {
    const { signal, divergenceScore } = analyzeDivergence(p.token, p.smartMoneyScore);
    let action: RecommendationAction = "HOLD";
    let target = p.allocation;
    let reason = `スマートマネースコア ${p.smartMoneyScore}、乖離スコア ${divergenceScore}。現状維持が妥当。`;

    if (signal === "SMART_MONEY_BEARISH" || (p.riskScore > 0.7 && riskTolerance !== "HIGH")) {
      action = p.smartMoneyScore < 0.3 ? "EXIT" : "REDUCE";
      target = action === "EXIT" ? 0 : round(p.allocation * 0.5, 3);
      reason = `スマートマネーが離脱方向。Divergence Score ${divergenceScore}（SMART_MONEY_BEARISH）。リスク${p.riskScore}を縮小。`;
    } else if (signal === "SMART_MONEY_BULLISH" && p.smartMoneyScore > 0.6) {
      action = "INCREASE";
      target = round(Math.min(cap, p.allocation * 1.4 + 0.05), 3);
      reason = `スマートマネーの強い蓄積シグナル。Divergence Score ${divergenceScore}（SMART_MONEY_BULLISH）。`;
    }
    return { action, token: p.token, reason, targetAllocation: target };
  });

  recommendations.sort(
    (a, b) =>
      Math.abs(b.targetAllocation - allocOf(positions, b.token)) -
      Math.abs(a.targetAllocation - allocOf(positions, a.token)),
  );

  const riskLabel = overallRisk > 0.66 ? "高め" : overallRisk > 0.4 ? "中程度" : "低め";
  const alignLabel = smartMoneyAlignment > 0.6 ? "良好" : smartMoneyAlignment > 0.4 ? "やや弱い" : "弱い";
  const reduceTokens = recommendations
    .filter((r) => r.action === "REDUCE" || r.action === "EXIT")
    .map((r) => r.token);
  const increaseTokens = recommendations.filter((r) => r.action === "INCREASE").map((r) => r.token);

  const summary_ja =
    `現在のポートフォリオはリスク${riskLabel}（${overallRisk}）、スマートマネーとの整合は${alignLabel}（${smartMoneyAlignment}）です。` +
    (reduceTokens.length > 0
      ? `${reduceTokens.join("・")}でスマートマネーの離脱が見られるため比率縮小を検討してください。`
      : "明確な離脱シグナルは見られません。") +
    (increaseTokens.length > 0
      ? `一方、${increaseTokens.join("・")}は蓄積シグナルが強く、リスク許容度${riskTolerance}の範囲で増配余地があります。`
      : "");

  return { recommendations, summary_ja, confidence: 0.74 };
}

/* ----------------------------- history analysis ----------------------------- */

export async function analyzeHistory(walletAddress: string): Promise<HistoryAnalysis> {
  const windowDays = 90;
  const seed = hashString(`history:${walletAddress.toLowerCase()}`);

  const history: HistoryPoint[] = [];
  let value = 18000 + seededUnit(seed) * 57000;
  let smartMoney = 35 + seededUnit(seed + 11) * 35;
  const now = Date.now();

  for (let i = windowDays - 1; i >= 0; i--) {
    const dayseed = seed + i * 2654435761;
    const smDelta = (seededUnit(dayseed) - 0.5) * 9;
    smartMoney = clampRange(smartMoney + smDelta, 5, 95);
    const valueReturn = (smartMoney - 50) / 50 * 0.012 + (seededUnit(dayseed + 7) - 0.5) * 0.05;
    value = Math.max(1000, value * (1 + valueReturn));
    history.push({
      date: new Date(now - i * 86400000).toISOString().slice(0, 10),
      valueUsd: round(value, 2),
      smartMoneyIndex: round(smartMoney, 1),
    });
  }

  const valueReturns: number[] = [];
  const smartDeltas: number[] = [];
  for (let i = 1; i < history.length; i++) {
    valueReturns.push(history[i].valueUsd / history[i - 1].valueUsd - 1);
    smartDeltas.push(history[i].smartMoneyIndex - history[i - 1].smartMoneyIndex);
  }
  const correlation = round(pearson(valueReturns, smartDeltas), 2);
  const changePct = round(
    (history[history.length - 1].valueUsd / history[0].valueUsd - 1) * 100,
    2,
  );

  const insights = buildHistoryInsights(correlation, changePct, history);
  const summary_ja = await historySummary(walletAddress, correlation, changePct, insights);

  return {
    walletAddress,
    analyzedAt: new Date().toISOString(),
    windowDays,
    history,
    correlation,
    changePct,
    summary_ja,
    insights,
  };
}

function buildHistoryInsights(
  correlation: number,
  changePct: number,
  history: HistoryPoint[],
): string[] {
  const peak = history.reduce((a, b) => (b.valueUsd > a.valueUsd ? b : a));
  const trough = history.reduce((a, b) => (b.valueUsd < a.valueUsd ? b : a));
  const insights = [
    correlation > 0.35
      ? `ポートフォリオ価値はスマートマネー指標と正の相関（${correlation}）。シグナル追随型の動き。`
      : correlation < -0.35
        ? `スマートマネー指標と負の相関（${correlation}）。逆張り傾向が強くリスク要因。`
        : `スマートマネー指標との相関は限定的（${correlation}）。独自要因の影響が大きい。`,
    `90日間の損益は ${changePct > 0 ? "+" : ""}${changePct}%。`,
    `最高値 $${peak.valueUsd.toLocaleString()}（${peak.date}）／最安値 $${trough.valueUsd.toLocaleString()}（${trough.date}）。`,
  ];
  return insights;
}

async function historySummary(
  walletAddress: string,
  correlation: number,
  changePct: number,
  insights: string[],
): Promise<string> {
  const fallback =
    `過去90日間でポートフォリオ価値は ${changePct > 0 ? "+" : ""}${changePct}% 推移しました。` +
    `スマートマネー指標との相関は ${correlation} で、` +
    (correlation > 0.35
      ? "スマートマネーの動きにおおむね追随しています。"
      : correlation < -0.35
        ? "スマートマネーと逆方向に動く局面が多く注意が必要です。"
        : "スマートマネーとの連動性は弱めです。");

  const text = await callClaude(
    "あなたはDeFiポートフォリオアナリストです。日本語で2〜3文の簡潔な総括のみを返してください。",
    [
      `ウォレット: ${walletAddress}`,
      `90日損益: ${changePct}% / スマートマネー相関: ${correlation}`,
      ...insights,
    ].join("\n"),
    400,
  );
  return text ?? fallback;
}

/* ----------------------------- rebalance simulation ----------------------------- */

interface LoosePosition {
  token?: unknown;
  allocation?: unknown;
  valueUsd?: unknown;
  riskScore?: unknown;
  smartMoneyScore?: unknown;
  divergenceScore?: unknown;
}

export async function simulateRebalance(
  currentPortfolio: unknown,
  proposedChanges: unknown,
): Promise<SimulationResult> {
  const positions = normalizePositions(currentPortfolio);
  const targets = extractTargets(proposedChanges);

  const before = metricsFor(positions, currentAllocations(positions));
  const after = metricsFor(positions, applyTargets(positions, targets));

  const deltas: SimulationMetrics = {
    risk: round(after.risk - before.risk, 3),
    expectedReturn: round(after.expectedReturn - before.expectedReturn, 3),
    smartMoneyAlignment: round(after.smartMoneyAlignment - before.smartMoneyAlignment, 3),
  };

  let verdict: SimulationResult["verdict"] = "NEUTRAL";
  if (deltas.risk <= -0.02 && deltas.expectedReturn >= -0.01) verdict = "FAVORABLE";
  else if (deltas.risk >= 0.04 && deltas.expectedReturn < 0) verdict = "UNFAVORABLE";
  else if (deltas.smartMoneyAlignment >= 0.05 && deltas.risk <= 0.01) verdict = "FAVORABLE";

  const summary_ja = await simulationSummary(before, after, deltas, verdict);

  return {
    analyzedAt: new Date().toISOString(),
    before,
    after,
    deltas,
    verdict,
    summary_ja,
    confidence: 0.72,
  };
}

function normalizePositions(input: unknown): Position[] {
  const root = input as { positions?: unknown } | unknown[];
  const rawList: unknown[] = Array.isArray(root)
    ? root
    : Array.isArray((root as { positions?: unknown })?.positions)
      ? ((root as { positions: unknown[] }).positions)
      : [];

  const positions: Position[] = [];
  for (const raw of rawList) {
    const p = raw as LoosePosition;
    const token = typeof p.token === "string" ? p.token : null;
    if (!token) continue;
    const valueUsd = Number(p.valueUsd) || 0;
    const smartMoneyScore =
      typeof p.smartMoneyScore === "number" ? clamp01(p.smartMoneyScore) : simulatedScore(token);
    const divergenceScore =
      typeof p.divergenceScore === "number"
        ? clamp01(p.divergenceScore)
        : analyzeDivergence(token, smartMoneyScore).divergenceScore;
    const riskScore =
      typeof p.riskScore === "number"
        ? clamp01(p.riskScore)
        : tokenRiskScore(token, smartMoneyScore, divergenceScore);
    positions.push({
      token,
      valueUsd,
      allocation: typeof p.allocation === "number" ? clamp01(p.allocation) : 0,
      smartMoneyScore,
      divergenceScore,
      riskScore,
    });
  }

  if (positions.length === 0) {
    // Nothing usable was supplied — synthesise a small baseline portfolio.
    for (const token of ["ETH", "SOL", "USDC"]) {
      const smartMoneyScore = simulatedScore(token);
      const divergenceScore = analyzeDivergence(token, smartMoneyScore).divergenceScore;
      positions.push({
        token,
        valueUsd: 10000,
        allocation: 1 / 3,
        smartMoneyScore,
        divergenceScore,
        riskScore: tokenRiskScore(token, smartMoneyScore, divergenceScore),
      });
    }
  }
  return positions;
}

function extractTargets(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;

  const recs = obj.recommendations;
  if (Array.isArray(recs)) {
    for (const r of recs) {
      const rec = r as Record<string, unknown>;
      if (typeof rec.token === "string" && Number.isFinite(Number(rec.targetAllocation))) {
        out[rec.token] = clamp01(Number(rec.targetAllocation));
      }
    }
    return out;
  }

  const allocations = (obj.allocations ?? obj) as Record<string, unknown>;
  for (const [token, value] of Object.entries(allocations)) {
    if (typeof value === "number" && Number.isFinite(value)) out[token] = clamp01(value);
  }
  return out;
}

function currentAllocations(positions: Position[]): number[] {
  const total = positions.reduce((s, p) => s + p.valueUsd, 0);
  if (total > 0) return positions.map((p) => p.valueUsd / total);
  const allocTotal = positions.reduce((s, p) => s + p.allocation, 0) || 1;
  return positions.map((p) => p.allocation / allocTotal);
}

function applyTargets(positions: Position[], targets: Record<string, number>): number[] {
  const current = currentAllocations(positions);
  const raw = positions.map((p, i) => (p.token in targets ? targets[p.token] : current[i]));
  const sum = raw.reduce((s, v) => s + v, 0) || 1;
  return raw.map((v) => v / sum);
}

function metricsFor(positions: Position[], allocations: number[]): SimulationMetrics {
  let risk = 0;
  let alignment = 0;
  let expectedReturn = 0;
  positions.forEach((p, i) => {
    const a = allocations[i] ?? 0;
    risk += a * p.riskScore;
    alignment += a * p.smartMoneyScore;
    const { signal } = analyzeDivergence(p.token, p.smartMoneyScore);
    expectedReturn += a * tokenExpectedReturn(p.smartMoneyScore, p.divergenceScore, signal);
  });
  return {
    risk: round(risk, 3),
    expectedReturn: round(expectedReturn, 3),
    smartMoneyAlignment: round(alignment, 3),
  };
}

async function simulationSummary(
  before: SimulationMetrics,
  after: SimulationMetrics,
  deltas: SimulationMetrics,
  verdict: SimulationResult["verdict"],
): Promise<string> {
  const verdictLabel =
    verdict === "FAVORABLE" ? "改善" : verdict === "UNFAVORABLE" ? "悪化" : "中立";
  const fallback =
    `提案後のリスクは ${before.risk} → ${after.risk}（${fmtDelta(deltas.risk)}）、` +
    `期待リターンは ${before.expectedReturn} → ${after.expectedReturn}（${fmtDelta(deltas.expectedReturn)}）、` +
    `スマートマネー整合は ${before.smartMoneyAlignment} → ${after.smartMoneyAlignment}（${fmtDelta(deltas.smartMoneyAlignment)}）。` +
    `総合評価は「${verdictLabel}」です。`;

  const text = await callClaude(
    "あなたはDeFiポートフォリオアナリストです。リバランス前後の指標を踏まえ、日本語で2〜3文の評価のみを返してください。",
    [
      `前: ${JSON.stringify(before)}`,
      `後: ${JSON.stringify(after)}`,
      `差分: ${JSON.stringify(deltas)}`,
      `判定: ${verdict}`,
    ].join("\n"),
    400,
  );
  return text ?? fallback;
}

/* ----------------------------- helpers ----------------------------- */

function weighted(positions: Position[], pick: (p: Position) => number): number {
  const total = positions.reduce((s, p) => s + p.allocation, 0) || 1;
  return positions.reduce((s, p) => s + (p.allocation / total) * pick(p), 0);
}

function allocOf(positions: Position[], token: string): number {
  return positions.find((p) => p.token === token)?.allocation ?? 0;
}

function clampRange(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmtDelta(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}
