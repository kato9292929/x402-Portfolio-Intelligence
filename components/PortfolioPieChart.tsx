import type { Position } from "@/lib/types";

const COLORS = [
  "#c8a96e",
  "#e0c897",
  "#9a7d4a",
  "#d9b98a",
  "#7a6845",
  "#bfa06a",
  "#8c7a55",
  "#efdcb4",
];

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PortfolioPieChart({ positions }: { positions: Position[] }) {
  const total = positions.reduce((s, p) => s + p.allocation, 0) || 1;

  let offset = 0;
  const segments = positions.map((p, i) => {
    const fraction = p.allocation / total;
    const seg = {
      token: p.token,
      color: COLORS[i % COLORS.length],
      fraction,
      dash: fraction * CIRCUMFERENCE,
      offset,
    };
    offset += seg.dash;
    return seg;
  });

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <svg width="180" height="180" viewBox="0 0 200 200" role="img" aria-label="保有比率">
        <g transform="rotate(-90 100 100)">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="#2a2823"
            strokeWidth="26"
          />
          {segments.map((s) => (
            <circle
              key={s.token}
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text
          x="100"
          y="95"
          textAnchor="middle"
          fill="#8f8a80"
          fontSize="11"
          letterSpacing="2"
        >
          TOKENS
        </text>
        <text
          x="100"
          y="118"
          textAnchor="middle"
          fill="#ededed"
          fontSize="26"
          fontWeight="600"
        >
          {positions.length}
        </text>
      </svg>

      <div className="legend" style={{ flex: 1, minWidth: 180 }}>
        {segments.map((s) => (
          <div className="legend-row" key={s.token}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="lg-token">{s.token}</span>
            <span className="lg-pct">{(s.fraction * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
