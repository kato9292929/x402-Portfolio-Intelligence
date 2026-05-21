const CX = 110;
const CY = 110;
const R = 88;

function polar(value0to100: number) {
  const angle = Math.PI * (1 - Math.min(100, Math.max(0, value0to100)) / 100);
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
    angle,
  };
}

function riskColor(value: number): string {
  if (value < 40) return "#5fb87a";
  if (value < 70) return "#c8a96e";
  return "#d9744f";
}

function riskLabel(value: number): string {
  if (value < 40) return "低リスク";
  if (value < 70) return "中リスク";
  return "高リスク";
}

/** Semicircular 0–100 risk gauge. `value` is a 0–1 risk score. */
export function RiskMeter({ value }: { value: number }) {
  const score = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = riskColor(score);
  const end = polar(score);
  const needle = {
    x: CX + (R - 18) * Math.cos(end.angle),
    y: CY - (R - 18) * Math.sin(end.angle),
  };

  return (
    <div>
      <svg
        width="220"
        height="142"
        viewBox="0 0 220 142"
        role="img"
        aria-label={`リスクスコア ${score}`}
        style={{ display: "block", margin: "0 auto" }}
      >
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#2a2823"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {score > 0 && (
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
          />
        )}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r="6" fill={color} />
        <text x={CX - R} y={CY + 26} textAnchor="middle" fill="#8f8a80" fontSize="11">
          0
        </text>
        <text x={CX + R} y={CY + 26} textAnchor="middle" fill="#8f8a80" fontSize="11">
          100
        </text>
      </svg>
      <div className="meter-value">
        <div className="num" style={{ color }}>
          {score}
        </div>
        <div className="label">{riskLabel(score)}</div>
      </div>
    </div>
  );
}
