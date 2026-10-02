import type { Complaint, ConsumerMessageRecord } from "@/lib/api/types";

/** Pure title/label functions for Consumers & Channels (D21). */

export function moneyshotTitle(openComplaints: number): string {
  return `${openComplaints} complaints still open`;
}

export function outboxTitle(count: number): string {
  return `${count} channel messages (WhatsApp/IVR/SMS)`;
}

export function channelCounts(messages: ConsumerMessageRecord[]): Record<ConsumerMessageRecord["channel"], number> {
  return messages.reduce<Record<ConsumerMessageRecord["channel"], number>>(
    (acc, m) => ({ ...acc, [m.channel]: (acc[m.channel] ?? 0) + 1 }),
    { whatsapp: 0, ivr: 0, sms: 0 },
  );
}

export function openComplaintCount(complaints: Complaint[]): number {
  return complaints.filter((c) => c.status === "open").length;
}
