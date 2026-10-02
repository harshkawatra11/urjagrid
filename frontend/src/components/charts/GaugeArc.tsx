import { ChartFrame } from "./common";
import { clamp } from "@/lib/format";

/** A single-value arc gauge (0..max), e.g. DT loading pu or served fraction. Pure inline SVG, no recharts dependency. */
export function GaugeArc({
  value,
  max = 1,
  size = 140,
  color = "var(--brand)",
  trackColor = "var(--surface-3)",
  valueLabel,
  label = "Gauge",
}: {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  trackColor?: string;
  valueLabel?: string;
  label?: string;
}) {
  const fraction = clamp(value / max, 0, 1);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = Math.PI; // left
  const endAngle = Math.PI + Math.PI * fraction;
  const point = (angle: number) => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  const start = point(startAngle);
  const end = point(startAngle + Math.PI);
  const valuePoint = point(endAngle);
  const largeArc = fraction > 0.5 ? 1 : 0;

  return (
    <ChartFrame label={label}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={trackColor}
          strokeWidth={10}
          strokeLinecap="round"
        />
        {fraction > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${valuePoint.x} ${valuePoint.y}`}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 2} textAnchor="middle" className="num" fontSize={18} fill="var(--text)" fontWeight={600}>
          {valueLabel ?? value.toFixed(2)}
        </text>
      </svg>
    </ChartFrame>
  );
}
