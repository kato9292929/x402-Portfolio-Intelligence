"use client";

import type { PortfolioAnalysis } from "@/lib/types";
import { PortfolioPieChart } from "./PortfolioPieChart";
import { RecommendationList } from "./RecommendationList";
import { RiskMeter } from "./RiskMeter";
import { SmartMoneyGauge } from "./SmartMoneyGauge";

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function ResultView({ analysis }: { analysis: PortfolioAnalysis }) {
  const { portfolio, analysis: a } = analysis;

  return (
    <div className="results fade-in">
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

      <div className="panel">
        <div className="section-title">リバランス推奨アクション</div>
        <RecommendationList recommendations={a.recommendations} />
      </div>
    </div>
  );
}
