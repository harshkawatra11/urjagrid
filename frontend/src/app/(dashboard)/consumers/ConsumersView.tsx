"use client";

import { useState } from "react";
import { useScope } from "@/lib/scope";
import { useConsumerMessages, useComplaints, useConsumersList } from "@/lib/api/hooks";
import { Card } from "@/components/ds/Card";
import { PageHeader } from "@/components/ds/PageHeader";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { PhoneFrame } from "@/components/ds/PhoneFrame";
import { HourHeatmap, type HourHeatmapCell } from "@/components/charts/HourHeatmap";
import { CompareBars } from "@/components/charts/CompareBars";
import { formatIstTime } from "@/lib/format";
import { channelCounts, moneyshotTitle, openComplaintCount, outboxTitle } from "./titles";

export function ConsumersView() {
  const { scope } = useScope();
  const { data: messagesData, isLoading, offline } = useConsumerMessages(scope);
  const { data: complaintsData } = useComplaints(scope);
  const { data: consumersData } = useConsumersList(scope);
  const messages = messagesData?.messages ?? [];
  const complaints = complaintsData?.complaints ?? [];
  const consumers = consumersData?.consumers ?? [];
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (isLoading && messages.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Registries" title="Consumers & Channels" description="Message outbox, complaints, and the consumer-facing preview." />
        <PanelSkeleton />
      </div>
    );
  }

  const counts = channelCounts(messages);
  const previewMessages = messages.filter((m) => m.consumerId === (previewId ?? messages[0]?.consumerId));
  const channelRows = (["whatsapp", "ivr", "sms"] as const).map((c) => ({ label: c.toUpperCase(), solution: counts[c], baseline: 0 }));
  const heatCells: HourHeatmapCell[] = messages.map((m, i) => ({
    row: m.channel,
    hour: new Date(m.timestampIso).getHours(),
    value: Math.min(1, (i + 1) / messages.length),
  }));

  return (
    <div className="grid grid-cols-12 gap-3">
      {offline && (
        <div className="col-span-12">
          <OfflineBanner />
        </div>
      )}
      <div className="col-span-12">
        <PageHeader eyebrow="Registries" title="Consumers & Channels" description="Outbound notices, inbound replies, and consumer complaints across WhatsApp, IVR, and SMS." />
      </div>

      <Card title="Open complaints" eyebrow="Moneyshot" className="col-span-12 lg:col-span-4">
        <p className="num text-[26px] font-semibold text-text">{openComplaintCount(complaints)}</p>
        <p className="mt-1 text-[12px] text-muted">{moneyshotTitle(openComplaintCount(complaints))}</p>
      </Card>

      <Card title="WhatsApp" eyebrow="Channel" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.whatsapp}</p>
      </Card>
      <Card title="IVR" eyebrow="Channel" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.ivr}</p>
      </Card>
      <Card title="SMS" eyebrow="Channel" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{counts.sms}</p>
      </Card>
      <Card title="Consumers in scope" eyebrow="Registry" className="col-span-6 lg:col-span-2">
        <p className="num text-[22px] font-semibold text-text">{consumers.length}</p>
      </Card>

      <Card title={outboxTitle(messages.length)} eyebrow="Outbox" className="col-span-12 lg:col-span-7">
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-md border border-border p-2 text-[12px]">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-text">{m.consumerId}</span>
                <span className="text-faint">{m.channel} · {m.direction} · {formatIstTime(m.timestampIso)}</span>
              </div>
              <p className="text-muted">{m.bodyHi}</p>
              <button type="button" onClick={() => setPreviewId(m.consumerId)} className="mt-1 text-[11px] text-brand hover:underline">
                Preview on phone
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Consumer preview" eyebrow="PhoneFrame" className="col-span-12 lg:col-span-5">
        <PhoneFrame>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted">{previewId ?? messages[0]?.consumerId ?? "No consumer"}</p>
            {previewMessages.map((m) => (
              <div key={m.id} className={m.direction === "outbound" ? "rounded-lg bg-surface-2 p-2" : "rounded-lg bg-brand-soft p-2"}>
                <p className="text-[12px] text-text">{m.bodyHi}</p>
                <p className="mt-1 text-[10px] text-faint">{formatIstTime(m.timestampIso)}</p>
              </div>
            ))}
            {previewMessages.length === 0 && <p className="text-[11px] text-faint">No messages for this consumer.</p>}
          </div>
        </PhoneFrame>
      </Card>

      <Card title="Channel mix" eyebrow="Chart" className="col-span-12 lg:col-span-6">
        <CompareBars rows={channelRows} unit="msgs" />
      </Card>

      <Card title="Send-time heatmap" eyebrow="Channel x hour" className="col-span-12 lg:col-span-6">
        <HourHeatmap rows={["whatsapp", "ivr", "sms"]} cells={heatCells} />
      </Card>

      <Card title="Complaints" eyebrow="Registry" className="col-span-12">
        <table className="w-full border-separate border-spacing-y-1 text-[12px]">
          <thead>
            <tr className="text-left text-faint">
              <th className="px-2 py-1">Consumer</th>
              <th className="px-2 py-1">Kind</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Message</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-1.5 text-text">{c.consumerId}</td>
                <td className="px-2 py-1.5 text-muted capitalize">{c.kind}</td>
                <td className="px-2 py-1.5">
                  <span className={c.status === "resolved" ? "text-green" : c.status === "ack" ? "text-amber" : "text-red"}>
                    {c.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-muted">{c.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
