"use client";

import { useState } from "react";
import { useConsumerStatus, useConsumerMessages } from "@/lib/api/hooks";
import { reportOutage } from "@/lib/api/mutations";
import { Card } from "@/components/ds/Card";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { formatIstTime } from "@/lib/format";
import { availableHoursCount, lifelineGuaranteeLine, shedHoursCount, weatherHeadline } from "./titles";

/** Demo consumer id (SPEC ID convention `c_sn_01_0007`). A real deployment resolves this from
 * the logged-in consumer's session, not a constant. */
const DEMO_CONSUMER_ID = "c_sn_01_0007";

const BLOCK_COLOR: Record<string, string> = {
  available: "var(--green)",
  lifeline: "var(--amber)",
  shed: "var(--red)",
};

export function ConsumerAppView() {
  const { data: status, isLoading, offline } = useConsumerStatus(DEMO_CONSUMER_ID);
  const { data: messagesData } = useConsumerMessages("all");
  const messages = (messagesData?.messages ?? []).filter((m) => m.consumerId === DEMO_CONSUMER_ID);

  const [drAccepted, setDrAccepted] = useState(false);
  const [outageOpen, setOutageOpen] = useState(false);
  const [outageDescription, setOutageDescription] = useState("");
  const [outageResult, setOutageResult] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [askResult, setAskResult] = useState<string | null>(null);

  if (isLoading && !status) {
    return (
      <div>
        <h1 className="mb-3 text-[18px] font-semibold text-text">UrjaGrid</h1>
        <PanelSkeleton />
      </div>
    );
  }

  async function submitOutage() {
    const result = await reportOutage("", DEMO_CONSUMER_ID, outageDescription || "बिजली नहीं है।");
    setOutageResult(result.ok ? "आपकी शिकायत दर्ज कर ली गई है। जल्द कार्रवाई होगी।" : "अभी दर्ज नहीं हो पाया, कृपया फिर कोशिश करें।");
    setOutageOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {offline && <OfflineBanner />}
      <header>
        <p className="text-[11px] uppercase tracking-[0.1em] text-faint">UrjaGrid</p>
        <h1 className="text-[18px] font-semibold text-text">नमस्ते, {status?.name ?? "उपभोक्ता"}</h1>
      </header>

      <Card title={weatherHeadline(status)} eyebrow="बिजली मौसम">
        <p className="text-[13px] text-text">{lifelineGuaranteeLine(status?.lifelineGuaranteeW ?? 300)}</p>
      </Card>

      <Card title="आज के 24 घंटे" eyebrow="बिजली उपलब्धता">
        <div className="grid grid-cols-12 gap-[3px]">
          {(status?.availabilityBlocks ?? []).map((b, hour) => (
            <div key={hour} title={`${hour}:00 — ${b}`} className="h-6 rounded-[2px]" style={{ background: BLOCK_COLOR[b] }} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-faint">
          {availableHoursCount(status?.availabilityBlocks ?? [])} घंटे पूरी बिजली, {shedHoursCount(status?.availabilityBlocks ?? [])} घंटे बंद।
        </p>
      </Card>

      {status?.drAsk && (
        <Card title="आज का डिमांड रेस्पॉन्स निवेदन" eyebrow="Urja">
          <p className="text-[13px] text-text">{status.drAsk.headlineHi}</p>
          <p className="mt-1 text-[11px] text-faint">
            {formatIstTime(status.drAsk.windowStartIso)} – {formatIstTime(status.drAsk.windowEndIso)} · ₹{status.drAsk.rebateRsPerKwh}/यूनिट छूट
          </p>
          {drAccepted ? (
            <p className="mt-2 text-[12px] font-medium text-green">आपने स्वीकार कर लिया है, धन्यवाद!</p>
          ) : (
            <button type="button" onClick={() => setDrAccepted(true)} className="mt-2 h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black">
              स्वीकार करें
            </button>
          )}
        </Card>
      )}

      <Card title="संदेश" eyebrow="WhatsApp / IVR">
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-md border border-border p-2 text-[12px]">
              <p className="text-text">{m.bodyHi}</p>
              <p className="mt-0.5 text-[10px] text-faint">{formatIstTime(m.timestampIso)}</p>
              {m.audioUrl && (
                <audio controls src={m.audioUrl} className="mt-1 h-7 w-full">
                  <track kind="captions" />
                </audio>
              )}
            </li>
          ))}
          {messages.length === 0 && <p className="text-[11px] text-faint">कोई संदेश नहीं।</p>}
        </ul>
      </Card>

      <Card title="बिजली गई?" eyebrow="शिकायत">
        {outageOpen ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={outageDescription}
              onChange={(e) => setOutageDescription(e.target.value)}
              placeholder="क्या हुआ, यहां लिखें..."
              className="h-16 rounded-md border border-border bg-surface-1 p-2 text-[12px]"
            />
            <button type="button" onClick={submitOutage} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black">
              शिकायत दर्ज करें
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setOutageOpen(true)} className="h-8 w-full rounded-md border border-red px-3 text-[12px] font-medium text-red">
            बिजली गई? यहां दर्ज करें
          </button>
        )}
        {outageResult && <p className="mt-2 text-[12px] text-muted">{outageResult}</p>}
      </Card>

      <Card title="ऊर्जा से पूछें" eyebrow="Ask Urja">
        <textarea
          value={askText}
          onChange={(e) => setAskText(e.target.value)}
          placeholder="अपना सवाल यहां लिखें..."
          className="h-16 w-full rounded-md border border-border bg-surface-1 p-2 text-[12px]"
        />
        <button
          type="button"
          onClick={() => {
            setAskResult("ऊर्जा इस डेमो में अभी जवाब नहीं दे पा रही, लेकिन आपका सवाल दर्ज कर लिया गया है।");
            setAskText("");
          }}
          disabled={!askText}
          className="mt-2 h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40"
        >
          भेजें
        </button>
        {askResult && <p className="mt-2 text-[12px] text-muted">{askResult}</p>}
      </Card>
    </div>
  );
}
