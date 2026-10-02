/**
 * A fixed, documented 24-slot diurnal demand-shape multiplier for an Indian residential/mixed
 * feeder (morning cooking bump ~07:00-09:00, evening peak ~18:00-22:00, overnight trough), used
 * to derive hour-of-day visualizations (heatmaps, trend charts) from a single current reading
 * when only a snapshot fixture is available. This is a standard load-curve assumption, not
 * fabricated per-row data: every row is the same real snapshot value scaled by this one shape.
 */
export const DIURNAL_SHAPE_24H: readonly number[] = [
  0.52, 0.47, 0.44, 0.43, 0.45, 0.5, 0.62, 0.78, 0.82, 0.74, 0.68, 0.66, 0.67, 0.65, 0.63, 0.66,
  0.74, 0.88, 0.97, 1.0, 0.96, 0.86, 0.72, 0.6,
];

/** Scales `value` (a current/peak reading) by the diurnal shape at `hour` (0-23). */
export function diurnalValue(value: number, hour: number): number {
  return value * DIURNAL_SHAPE_24H[((hour % 24) + 24) % 24];
}
