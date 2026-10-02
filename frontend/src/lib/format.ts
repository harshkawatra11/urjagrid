/** Generic number/date formatting helpers used across the dashboard. */

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatKw(valueKw: number, fractionDigits = 1): string {
  return `${formatNumber(valueKw, fractionDigits)} kW`;
}

export function formatKwh(valueKwh: number, fractionDigits = 1): string {
  return `${formatNumber(valueKwh, fractionDigits)} kWh`;
}

export function formatPercent(fraction: number, fractionDigits = 0): string {
  return `${formatNumber(fraction * 100, fractionDigits)}%`;
}

export function formatRupees(valueRs: number, fractionDigits = 0): string {
  return `₹${formatNumber(valueRs, fractionDigits)}`;
}

export function formatSign(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, fractionDigits)}`;
}

export function formatIstTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function formatIstDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
