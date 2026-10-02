import { KindChip } from "@/components/ds/chips";
import { StatusTag } from "@/components/ds/StatusTag";
import { formatIstTime } from "@/lib/format";
import type { ProtocolMessageRecord } from "@/lib/api/types";

/** Renders one protocol ledger entry (HES/OCPP/OpenADR/Beckn/WhatsApp/IVR/SMS). Every protocol in
 * the ledger is tagged WIRED (SPEC section 1): simulated against an in-process adapter, not real hardware. */
export function ProtocolMessage({ message }: { message: ProtocolMessageRecord }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-surface-1 p-2.5 text-[12px]">
      <KindChip kind={message.protocol} size="sm" />
      <div className="flex-1">
        <p className="text-text">{message.summary}</p>
        <p className="num mt-0.5 text-[11px] text-faint">
          {message.direction} · {formatIstTime(message.timestampIso)} · {message.status}
        </p>
      </div>
      <StatusTag status="WIRED" size="sm" />
    </div>
  );
}
