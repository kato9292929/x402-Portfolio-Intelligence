const R = 62;
const C = 2 * Math.PI * R;

function alignColor(pct: number): string {
  if (pct >= 65) return "#5fb87a";
  if (pct >= 45) return "#c8a96e";
  return "#d9744f";
}

function alignLabel(pct: number): string {
  if (pct >= 65) return "整合 良好";
  if (pct >= 45) return "整合 やや弱い";
  return "整合 弱い";
}

/** Circular gauge for the smart money alignment score (`value` is 0–1). */
export function SmartMoneyGauge({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = alignColor(pct);
  const dash = (pct / 100) * C;

  return (
    <div>
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        role="img"
        aria-label={`スマートマネー整合 ${pct}%`}
        style={{ display: "block", margin: "0 auto" }}
      >
        <circle cx="80" cy="80" r={R} fill="none" stroke="#2a2823" strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={C / 4}
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="76" textAnchor="middle" fill="#ededed" fontSize="32" fontWeight="600">
          {pct}
        </text>
        <text x="80" y="98" textAnchor="middle" fill="#8f8a80" fontSize="12" letterSpacing="1">
          %
        </text>
      </svg>
      <div className="meter-value">
        <div className="label" style={{ color }}>
          {alignLabel(pct)}
        </div>
      </div>
    </div>
  );
}
