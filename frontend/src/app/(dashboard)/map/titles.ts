export const LAYER_KEYS = ["serviceArea", "feeder", "dt", "asset"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];

export const LAYER_LABEL: Record<LayerKey, string> = {
  serviceArea: "Service areas (Voronoi)",
  feeder: "11kV feeders",
  dt: "Transformers (DT)",
  asset: "Critical facilities & assets",
};

export function consoleTitle(dtCount: number, feederCount: number): string {
  return `${dtCount} transformers, ${feederCount} feeders in view`;
}

export function selectionTitle(kind: "dt" | "feeder" | null, id: string | null): string {
  if (!kind || !id) return "No selection — click a feeder or DT";
  return kind === "dt" ? `Transformer ${id}` : `Feeder ${id}`;
}
