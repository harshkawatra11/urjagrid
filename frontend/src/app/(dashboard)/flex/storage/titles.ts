import type { P2pTrade, StorageAsset } from "@/lib/api/types";

/** Pure title/label functions for Storage & P2P / OpenADR+Beckn (D13). */

export function fleetTitle(count: number): string {
  return `${count} community storage assets dispatching`;
}

export function moneyshotTitle(totalDispatchKw: number): string {
  return `${totalDispatchKw.toFixed(1)} kW discharged right now (L4 lever)`;
}

export function avgSoc(assets: StorageAsset[]): number {
  return assets.length ? assets.reduce((s, a) => s + a.socPct, 0) / assets.length : 0;
}

export function tradeVolumeKwh(trades: P2pTrade[]): number {
  return trades.reduce((s, t) => s + t.energyKwh, 0);
}

export function tradeValueRs(trades: P2pTrade[]): number {
  return trades.reduce((s, t) => s + t.priceRs * t.energyKwh, 0);
}
