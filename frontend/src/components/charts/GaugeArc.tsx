import { ChartFrame } from "./common";
import { clamp } from "@/lib/format";
import { heatVar } from "@/lib/heat";

/**
 * A single-value arc gauge (0..max), e.g. DT loading pu, served fraction, approval rate, or BCR.
 * Pure inline SVG, no recharts dependency.
 *
 * When `color` is omitted, the arc colors itself along the green->yellow->red severity gradient
 * based on where `value` falls in [0, max], per `severity`: "goodHigh" (default — rates like
 * approval/success/BCR where a high value is the good outcome) reads green at the top of the
 * range and red near zero; "badHigh" (e.g. DT loading, a normalized risk/lens average) reads the
 * gradient the other way, green near zero and red near max. Pass an explicit `color` to opt out
 * (e.g. a fixed risk-level or categorical color).
 */
export function GaugeArc({
  value,
  max = 1,
  size = 140,
  color,
  severity = "goodHigh",
  trackColor = "var(--surface-3)",
  valueLabel,
  label = "Gauge",
}: {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  severity?: "goodHigh" | "badHigh";
  trackColor?: string;
  valueLabel?: string;
  label?: string;
}) {
  const fraction = clamp(value / max, 0, 1);
  const resolvedColor = color ?? heatVar(severity === "badHigh" ? fraction : 1 - fraction);
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
            stroke={resolvedColor}
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
