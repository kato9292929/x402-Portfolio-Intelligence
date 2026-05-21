"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import type { HistoryAnalysis, PortfolioAnalysis, SimulationResult } from "@/lib/types";
import { PaymentError, x402Fetch } from "@/lib/x402Client";
import { PortfolioPieChart } from "./PortfolioPieChart";
import { RecommendationList } from "./RecommendationList";
import { RiskMeter } from "./RiskMeter";
import { SmartMoneyGauge } from "./SmartMoneyGauge";

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof PaymentError) return err.message;
  if (err instanceof Error) return err.message;
  return "予期しないエラーが発生しました";
}

export function ResultView({ analysis }: { analysis: PortfolioAnalysis }) {
  const { data: walletClient } = useWalletClient();
  const { portfolio, analysis: a } = analysis;

  const [history, setHistory] = useState<HistoryAnalysis | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState<"history" | "simulate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runHistory() {
    setBusy("history");
    setError(null);
    try {
      const res = await x402Fetch(
        "/api/portfolio/history",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: analysis.walletAddress }),
        },
        walletClient,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "履歴分析に失敗しました");
      setHistory(data as HistoryAnalysis);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function runSimulation() {
    setBusy("simulate");
    setError(null);
    try {
      const res = await x402Fetch(
        "/api/portfolio/simulate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPortfolio: portfolio,
            proposedChanges: { recommendations: a.recommendations },
          }),
        },
        walletClient,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "シミュレーションに失敗しました");
      setSimulation(data as SimulationResult);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="results fade-in">
      {/* summary */}
      <div className="panel">
        <div className="summary-head">
          <div>
            <div className="section-title" style={{ marginBottom: 6 }}>
              ポートフォリオ総額
            </div>
            <div className="total">{usd(portfolio.totalValueUsd)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`tag ${analysis.dataSource === "live" ? "live" : ""}`}>
              {analysis.dataSource === "live" ? "LIVE DATA" : "SIMULATED"}
            </span>
            <span className="tag">{analysis.chain.toUpperCase()}</span>
            <span className="tag">RISK {analysis.riskTolerance}</span>
          </div>
        </div>
        <p style={{ marginTop: 16, lineHeight: 1.8, fontSize: 15 }}>{a.summary_ja}</p>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          AI信頼度: {(a.confidence * 100).toFixed(0)}% ・ 分析日時{" "}
          {new Date(analysis.analyzedAt).toLocaleString("ja-JP")}
        </p>
      </div>

      {/* pie + gauges */}
      <div className="grid-2-even">
        <div className="panel">
          <div className="section-title">ポートフォリオ構成</div>
          <PortfolioPieChart positions={portfolio.positions} />
        </div>
        <div className="panel">
          <div className="section-title">リスク & スマートマネー</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ flex: 1, minWidth: 190 }}>
              <RiskMeter value={a.overallRisk} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <SmartMoneyGauge value={a.smartMoneyAlignment} />
            </div>
          </div>
        </div>
      </div>

      {/* recommendations */}
      <div className="panel">
        <div className="section-title">リバランス推奨アクション</div>
        <RecommendationList recommendations={a.recommendations} />
      </div>

      {/* extended analysis actions */}
      <div className="panel">
        <div className="section-title">追加分析</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            onClick={runHistory}
            disabled={busy !== null}
          >
            {busy === "history" ? "分析中…" : "90日履歴を分析（$0.30）"}
          </button>
          <button
            className="btn-ghost"
            onClick={runSimulation}
            disabled={busy !== null}
          >
            {busy === "simulate" ? "計算中…" : "リバランスをシミュレート（$0.50）"}
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>

      {history && <HistoryPanel history={history} />}
      {simulation && <SimulationPanel simulation={simulation} />}
    </div>
  );
}

function HistoryPanel({ history }: { history: HistoryAnalysis }) {
  const max = Math.max(...history.history.map((p) => p.valueUsd), 1);
  const min = Math.min(...history.history.map((p) => p.valueUsd));

  return (
    <div className="panel fade-in">
      <div className="section-title">90日間のポートフォリオ推移</div>
      <div className="stat-strip" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div
            className="s-num"
            style={{ color: history.changePct >= 0 ? "#5fb87a" : "#d9744f" }}
          >
            {history.changePct >= 0 ? "+" : ""}
            {history.changePct}%
          </div>
          <div className="s-label">90日損益</div>
        </div>
        <div className="stat">
          <div className="s-num" style={{ color: "#c8a96e" }}>
            {history.correlation}
          </div>
          <div className="s-label">スマートマネー相関</div>
        </div>
        <div className="stat">
          <div className="s-num">{usd(min)}</div>
          <div className="s-label">期間最安値</div>
        </div>
      </div>
      <div className="spark">
        {history.history.map((p) => (
          <div
            key={p.date}
            className="spark-bar"
            style={{ height: `${Math.max(4, (p.valueUsd / max) * 100)}%` }}
            title={`${p.date}: ${usd(p.valueUsd)}`}
          />
        ))}
      </div>
      <p style={{ marginTop: 16, lineHeight: 1.8, fontSize: 14 }}>{history.summary_ja}</p>
      <ul className="insight-list">
        {history.insights.map((insight, i) => (
          <li key={i}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}

function SimulationPanel({ simulation }: { simulation: SimulationResult }) {
  const rows: { label: string; before: number; after: number; lowerIsBetter: boolean }[] = [
    { label: "リスク", before: simulation.before.risk, after: simulation.after.risk, lowerIsBetter: true },
    {
      label: "期待リターン",
      before: simulation.before.expectedReturn,
      after: simulation.after.expectedReturn,
      lowerIsBetter: false,
    },
    {
      label: "スマートマネー整合",
      before: simulation.before.smartMoneyAlignment,
      after: simulation.after.smartMoneyAlignment,
      lowerIsBetter: false,
    },
  ];

  return (
    <div className="panel fade-in">
      <div className="section-title">リバランスシミュレーション</div>
      <div style={{ marginBottom: 16 }}>
        <span className={`verdict ${simulation.verdict}`}>
          {simulation.verdict === "FAVORABLE"
            ? "改善が見込めます"
            : simulation.verdict === "UNFAVORABLE"
              ? "悪化の可能性"
              : "中立的な変化"}
        </span>
      </div>
      <div>
        {rows.map((row) => {
          const delta = Math.round((row.after - row.before) * 1000) / 1000;
          const improved = row.lowerIsBetter ? delta < 0 : delta > 0;
          return (
            <div className="sim-row" key={row.label}>
              <span>{row.label}</span>
              <span>
                <span className="muted">{row.before}</span>
                {" → "}
                <strong>{row.after}</strong>{" "}
                {delta !== 0 && (
                  <span className={improved ? "delta-up" : "delta-down"}>
                    ({delta > 0 ? "+" : ""}
                    {delta})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 16, lineHeight: 1.8, fontSize: 14 }}>{simulation.summary_ja}</p>
    </div>
  );
}
