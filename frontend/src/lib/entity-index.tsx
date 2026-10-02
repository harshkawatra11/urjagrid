"use client";

import { createContext, useContext, useMemo } from "react";
import { SUBDIVISION_IDS, SUBDIVISION_LABEL, type SubdivisionId } from "@/lib/scope";
import type { RiskLevel } from "@/lib/domain";

export type SubdivisionEntity = { id: SubdivisionId; name: string; shortName: string; risk?: RiskLevel };
export type TransformerEntity = { id: string; name: string; subdivisionId: string; riskLevel?: RiskLevel };
export type FeederEntity = { id: string; name: string; subdivisionId: string };
export type PlanEntity = { id: string; subdivisionId: string; status: string };

export type EntityData = {
  subdivisions: SubdivisionEntity[];
  transformers: TransformerEntity[];
  feeders: FeederEntity[];
  plans: PlanEntity[];
};

export type EntityIndex = EntityData & {
  subdivisionName: (id: string) => string;
  transformerName: (id: string) => string;
  feederName: (id: string) => string;
};

/** Static seed used before the data layer answers: the 5 canonical sub-divisions. */
export const STATIC_DATA: EntityData = {
  subdivisions: SUBDIVISION_IDS.map((id) => ({ id, name: SUBDIVISION_LABEL[id], shortName: SUBDIVISION_LABEL[id] })),
  transformers: [],
  feeders: [],
  plans: [],
};

export function buildEntityIndex(data: EntityData): EntityIndex {
  const subdivisionMap = new Map(data.subdivisions.map((d) => [d.id, d.name]));
  const transformerMap = new Map(data.transformers.map((t) => [t.id, t.name]));
  const feederMap = new Map(data.feeders.map((f) => [f.id, f.name]));
  return {
    ...data,
    subdivisionName: (id) => subdivisionMap.get(id) ?? id,
    transformerName: (id) => transformerMap.get(id) ?? id,
    feederName: (id) => feederMap.get(id) ?? id,
  };
}

const DEFAULT_INDEX = buildEntityIndex(STATIC_DATA);
const EntityIndexContext = createContext<EntityIndex>(DEFAULT_INDEX);

/** `ApiEntityIndexProvider` (lib/api/entities.tsx) passes live data; without `data` the static list is used. */
export function EntityIndexProvider({ data, children }: { data?: EntityData; children: React.ReactNode }) {
  const value = useMemo(() => (data ? buildEntityIndex(data) : DEFAULT_INDEX), [data]);
  return <EntityIndexContext.Provider value={value}>{children}</EntityIndexContext.Provider>;
}

export function useEntityIndex(): EntityIndex {
  return useContext(EntityIndexContext);
}
