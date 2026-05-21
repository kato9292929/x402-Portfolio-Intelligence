import type { Recommendation } from "@/lib/types";

const ACTION_LABEL: Record<Recommendation["action"], string> = {
  INCREASE: "増配",
  REDUCE: "縮小",
  HOLD: "維持",
  EXIT: "撤退",
};

export function RecommendationList({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return <p className="muted">推奨アクションはありません。</p>;
  }

  return (
    <div>
      {recommendations.map((rec, i) => (
        <div className="rec" key={`${rec.token}-${i}`}>
          <span className={`rec-badge ${rec.action}`}>{ACTION_LABEL[rec.action]}</span>
          <div className="rec-body">
            <div className="rec-token">{rec.token}</div>
            <div className="rec-reason">{rec.reason}</div>
          </div>
          <div className="rec-target">
            <div className="t-num">{(rec.targetAllocation * 100).toFixed(0)}%</div>
            <div className="t-label">TARGET</div>
          </div>
        </div>
      ))}
    </div>
  );
}
