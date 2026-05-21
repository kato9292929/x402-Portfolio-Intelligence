export type Chain = "solana" | "base" | "polygon";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

/** Raw token holding returned by an on-chain data provider. */
export interface TokenHolding {
  token: string;
  valueUsd: number;
}

export interface Position {
  token: string;
  valueUsd: number;
  allocation: number;
  smartMoneyScore: number;
  divergenceScore: number;
  riskScore: number;
}

export type RecommendationAction = "REDUCE" | "INCREASE" | "HOLD" | "EXIT";

export interface Recommendation {
  action: RecommendationAction;
  token: string;
  reason: string;
  targetAllocation: number;
}

export interface PortfolioAnalysis {
  walletAddress: string;
  chain: Chain;
  riskTolerance: RiskTolerance;
  analyzedAt: string;
  dataSource: "live" | "simulated";
  portfolio: {
    totalValueUsd: number;
    positions: Position[];
  };
  analysis: {
    overallRisk: number;
    smartMoneyAlignment: number;
    recommendations: Recommendation[];
    summary_ja: string;
    confidence: number;
  };
}

export interface HistoryPoint {
  date: string;
  valueUsd: number;
  smartMoneyIndex: number;
}

export interface HistoryAnalysis {
  walletAddress: string;
  analyzedAt: string;
  windowDays: number;
  history: HistoryPoint[];
  correlation: number;
  changePct: number;
  summary_ja: string;
  insights: string[];
}

export interface SimulationMetrics {
  risk: number;
  expectedReturn: number;
  smartMoneyAlignment: number;
}

export interface SimulationResult {
  analyzedAt: string;
  before: SimulationMetrics;
  after: SimulationMetrics;
  deltas: SimulationMetrics;
  verdict: "FAVORABLE" | "NEUTRAL" | "UNFAVORABLE";
  summary_ja: string;
  confidence: number;
}
