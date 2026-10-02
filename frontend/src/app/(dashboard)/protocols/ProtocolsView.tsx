"use client";

import { useState } from "react";
import { useProtocols } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { StatusTag } from "@/components/ds/StatusTag";
import { ProtocolMessage } from "@/components/grid/ProtocolMessage";
import { CompareBars } from "@/components/charts/CompareBars";
import { heatVar } from "@/lib/heat";
import { moneyshotTitle, PROTOCOL_LABEL, totalCount } from "./titles";

export function ProtocolsView() {
  const { data, isLoading, offline } = useProtocols();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const protocolNames = data?.protocolNames ?? [];
  const counts = data?.counts ?? {};
  const entries = data?.entries ?? [];

  if (isLoading && protocolNames.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Registries" title="Integrations" description="7 protocol adapters, every one tagged WIRED." />
        <PanelSkeleton />
      </div>
    );
  }

  const max = Math.max(1, ...Object.values(counts));
  const barRows = protocolNames.map((p) => ({ label: PROTOCOL_LABEL[p] ?? p, solution: counts[p] ?? 0, baseline: 0 }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader
          eyebrow="Registries"
          title="Integrations"
          description="HES, OCPP, OpenADR, Beckn/UEI, WhatsApp, IVR, SMS — spec-shaped adapters against in-process simulators, not real hardware."
        />
      </div>

      <Card title="Total messages" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{totalCount(counts).toLocaleString("en-IN")}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(totalCount(counts))}</p>
      </Card>

      <div className="col-span-12 grid grid-cols-7 gap-2 lg:col-span-8">
        {protocolNames.map((p) => (
          <Card key={p} title={PROTOCOL_LABEL[p] ?? p} eyebrow="WIRED" className="col-span-1">
            <p className="num text-[18px] font-semibold text-text">{counts[p] ?? 0}</p>
            <StatusTag status="WIRED" size="sm" />
          </Card>
        ))}
      </div>

      <Card title="Message volume by protocol" eyebrow="Chart" className="col-span-12 lg:col-span-6">
        <CompareBars rows={barRows} unit="" />
      </Card>

      <Card title="Volume heat matrix" eyebrow="Heatmap" className="col-span-12 lg:col-span-6">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {protocolNames.map((p) => (
            <div key={p} className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: heatVar((counts[p] ?? 0) / max) }} />
              <span className="text-[10px] text-muted">{p}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Live message log" eyebrow="LIVE" live className="col-span-12">
        <div className="space-y-2">
          {entries.map((m) => (
            <div key={m.id}>
              <ProtocolMessage message={m} />
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                className="mt-1 text-[11px] text-brand hover:underline"
              >
                {expandedId === m.id ? "Hide payload" : "Inspect payload"}
              </button>
              {expandedId === m.id && (
                <pre className="mt-1 overflow-x-auto rounded-md bg-surface-2 p-2 text-[11px] text-muted">
                  {JSON.stringify(m.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
