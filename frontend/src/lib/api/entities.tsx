"use client";

import { useMemo } from "react";
import { EntityIndexProvider, STATIC_DATA, type EntityData } from "@/lib/entity-index";
import { useSubdivisions, useTransformers, useFeeders, usePlans } from "./hooks";

/** Feeds `useEntityIndex()` from the SWR hooks (scope `all`, fixtures when offline). */
export function ApiEntityIndexProvider({ children }: { children: React.ReactNode }) {
  const subdivisions = useSubdivisions().data?.subdivisions;
  const transformers = useTransformers("all").data?.transformers;
  const feeders = useFeeders("all").data?.feeders;
  const plans = usePlans("all").data?.plans;

  const data = useMemo<EntityData>(() => {
    if (!subdivisions?.length) return STATIC_DATA;
    return {
      subdivisions: subdivisions.map((s) => ({ id: s.id, name: s.name, shortName: s.name, risk: s.riskLevel })),
      transformers: (transformers ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        subdivisionId: t.subdivisionId,
        riskLevel: t.riskLevel,
      })),
      feeders: (feeders ?? []).map((f) => ({ id: f.id, name: f.name, subdivisionId: f.subdivisionId })),
      plans: (plans ?? []).map((p) => ({ id: p.id, subdivisionId: p.subdivisionId, status: p.status })),
    };
  }, [subdivisions, transformers, feeders, plans]);

  return <EntityIndexProvider data={data}>{children}</EntityIndexProvider>;
}
