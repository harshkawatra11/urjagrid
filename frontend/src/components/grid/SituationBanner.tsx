import { AlertTriangle, ShieldCheck } from "lucide-react";
import { RISK_LEVEL_COLOR_VAR, RISK_LEVEL_LABEL, cssVar, type RiskLevel } from "@/lib/domain";
import { BRAND } from "@/lib/brand";

/** Top-of-page banner summarizing the current situation: worst risk level, headline, and the brand tagline. */
export function SituationBanner({
  riskLevel,
  headline,
  detail,
}: {
  riskLevel: RiskLevel;
  headline: string;
  detail?: string;
}) {
  const ok = riskLevel === "low";
  const Icon = ok ? ShieldCheck : AlertTriangle;
  const color = cssVar(RISK_LEVEL_COLOR_VAR[riskLevel]);

  return (
    <div
      className="flex items-center gap-3 rounded-md border p-3"
      style={{ borderColor: color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <Icon size={20} style={{ color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text">{headline}</p>
        {detail && <p className="text-[12px] text-muted">{detail}</p>}
      </div>
      <span className="eyebrow shrink-0" style={{ color }}>
        {RISK_LEVEL_LABEL[riskLevel]}
      </span>
      <span className="hidden shrink-0 text-[11px] italic text-faint sm:inline">{BRAND.tagline}</span>
    </div>
  );
}
