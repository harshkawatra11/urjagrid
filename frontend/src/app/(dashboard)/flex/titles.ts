/** D11 Live Grid Ops -- card action-titles computed from live data. */
export function mapTitle(activePlanCount: number): string {
  return activePlanCount === 0 ? "Live network map" : `Live network map -- ${activePlanCount} plan${activePlanCount === 1 ? "" : "s"} dispatching`;
}

export function meterCounterTitle(total: number): string {
  return `Meter states across ${total.toLocaleString("en-IN")} consumers`;
}

export function leverStackTitle(): string {
  return "Lever mix across active plans";
}

export function activePlansTitle(count: number): string {
  return `${count} active plan${count === 1 ? "" : "s"}`;
}

export function liveFeedTitle(connected: boolean): string {
  return connected ? "Live command feed" : "Live command feed (offline -- no stream)";
}

export function subdivisionStripTitle(count: number): string {
  return `${count} sub-divisions`;
}

export function historyTitle(count: number): string {
  return `Event history (${count})`;
}
