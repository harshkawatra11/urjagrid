import type { DrBelief, RebateLedgerEntry } from "@/lib/api/types";

/** Pure title/label + Beta-Bernoulli math helpers for the Demand Response page (D14). */

export function moneyshotTitle(totalRebateRs: number): string {
  return `₹${totalRebateRs.toFixed(0)} paid out in DR rebates`;
}

export function beliefTitle(count: number): string {
  return `${count} sub-division acceptance-belief distributions (Beta-Bernoulli)`;
}

/** log-Gamma via Stirling's approximation (good enough for the small integer-ish alpha/beta this
 * page uses); avoids pulling in a stats dependency for one chart. */
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const xx = x - 1;
  let a = c[0];
  const t = xx + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Beta(alpha, beta) probability density at x in (0,1). Pure, deterministic. */
export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
}

/** 41-point density curve over [0,1] for one belief, used by the chart. */
export function densityCurve(belief: DrBelief): Array<{ x: number; density: number }> {
  return Array.from({ length: 41 }, (_, i) => {
    const x = i / 40;
    return { x, density: betaPdf(x, belief.alpha, belief.beta) };
  });
}

export function totalRebate(ledger: RebateLedgerEntry[]): number {
  return ledger.reduce((s, r) => s + r.totalRebateRs, 0);
}

export function totalShifted(ledger: RebateLedgerEntry[]): number {
  return ledger.reduce((s, r) => s + r.kwhShifted, 0);
}
