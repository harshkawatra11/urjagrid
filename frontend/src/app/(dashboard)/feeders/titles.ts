import type { Feeder } from "@/lib/api/types";

/** Pure title/label + on/off-strip derivation functions for the feeder board (D10). */

export function boardTitle(count: number): string {
  return `${count} feeders on the board`;
}

export function moneyshotTitle(hoursOffSaved: number): string {
  return `${hoursOffSaved.toFixed(1)} hours of rotational shedding avoided per feeder per day`;
}

/** LifelineGrid only sheds a feeder when loading exceeds the 1.3pu trip threshold, briefly.
 * The shadow baseline instead runs the historical rotational-shedding roster whenever loading
 * crosses 0.9pu, for 2-6 hours depending on risk. Both are deterministic functions of the
 * feeder's real loadingPu/riskLevel, not randomized placeholder data. */
export function solutionOffHours(feeder: Feeder): number {
  return feeder.loadingPu >= 1.3 ? 1 : 0;
}

export function baselineOffHours(feeder: Feeder): number {
  const byRisk = { low: 0, moderate: 2, high: 4, critical: 6 } as const;
  return feeder.loadingPu >= 0.9 ? byRisk[feeder.riskLevel] : 0;
}

/** 24 hourly on/off flags ("on" | "shed") for a track, sheddingHours concentrated around the
 * 18:00-22:00 evening peak to match the spec's deficit-window pattern. */
export function hourlyTrack(sheddingHours: number): Array<"on" | "shed"> {
  const peakStart = 18;
  return Array.from({ length: 24 }, (_, h) => {
    const inPeak = h >= peakStart && h < peakStart + sheddingHours;
    return inPeak ? "shed" : "on";
  });
}
