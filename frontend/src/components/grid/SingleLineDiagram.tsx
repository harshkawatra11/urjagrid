import { RISK_LEVEL_COLOR_VAR, cssVar, type RiskLevel } from "@/lib/domain";

export type SldNode = { id: string; label: string; riskLevel?: RiskLevel };

/**
 * A minimal single-line diagram: substation -> feeder -> DT -> LV branches, rendered as inline
 * SVG (no chart library). Used on transformer and feeder case files to show the LV tree context.
 */
export function SingleLineDiagram({
  substation,
  feeder,
  transformer,
  branches,
  width = 560,
  height = 160,
}: {
  substation: SldNode;
  feeder: SldNode;
  transformer: SldNode;
  branches: SldNode[];
  width?: number;
  height?: number;
}) {
  const nodeColor = (n: SldNode) => (n.riskLevel ? cssVar(RISK_LEVEL_COLOR_VAR[n.riskLevel]) : "var(--text-faint)");
  const trunkY = height / 2;
  const xs = [40, width * 0.32, width * 0.6];
  const branchStartX = width * 0.6;
  const branchEndX = width - 20;
  const branchCount = Math.max(1, branches.length);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Single line diagram">
      <line x1={xs[0]} y1={trunkY} x2={xs[2]} y2={trunkY} stroke="var(--border-strong)" strokeWidth={2} />
      {[substation, feeder, transformer].map((n, i) => (
        <g key={n.id}>
          <circle cx={xs[i]} cy={trunkY} r={8} fill={nodeColor(n)} />
          <text x={xs[i]} y={trunkY - 16} textAnchor="middle" fontSize={11} fill="var(--text)">
            {n.label}
          </text>
        </g>
      ))}
      {branches.map((b, i) => {
        const bx = branchStartX + ((branchEndX - branchStartX) * (i + 1)) / (branchCount + 1);
        return (
          <g key={b.id}>
            <line x1={xs[2]} y1={trunkY} x2={bx} y2={height - 20} stroke="var(--border)" strokeWidth={1.5} />
            <circle cx={bx} cy={height - 20} r={5} fill={nodeColor(b)} />
            <text x={bx} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
