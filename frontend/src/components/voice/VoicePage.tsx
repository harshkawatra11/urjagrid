"use client";

import { useEffect } from "react";
import { LiveDot, type LiveState } from "@/components/ds/LiveDot";
import { ScopeSwitcher } from "@/components/shell/ScopeSwitcher";
import { useScope } from "@/lib/scope";
import { useVoice } from "@/lib/voice/VoiceSessionProvider";
import type { VoiceLanguage } from "@/lib/voice/protocol";
import { ConversationPanel } from "./ConversationPanel";
import { Orb } from "./Orb";

const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "हिंदी" },
];

const CONNECTION_LABEL: Record<string, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  failed: "Offline (voice backend unreachable)",
};

export function VoicePage() {
  const voice = useVoice();
  const { scope } = useScope();

  useEffect(() => {
    voice.connect(scope === "all" ? null : scope);
    return () => voice.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once per mount, scope read at connect time
  }, []);

  const live: LiveState = voice.state.status === "connected" ? "live" : voice.state.status === "connecting" ? "stale" : "offline";

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className="eyebrow">Command</p>
          <h1 className="text-[18px] font-semibold leading-tight text-text">Voice Control Room</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeSwitcher />
          <div role="radiogroup" aria-label="Language" className="inline-flex rounded-md border border-border">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={voice.state.language === l.value}
                onClick={() => voice.setLanguage(l.value)}
                className="h-8 px-2.5 text-[12px] first:rounded-l-md last:rounded-r-md"
                style={{
                  background: voice.state.language === l.value ? "var(--brand-soft)" : "transparent",
                  color: voice.state.language === l.value ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <span
            data-testid="connection-chip"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 text-[12px] text-text"
          >
            <LiveDot state={live} />
            {CONNECTION_LABEL[voice.state.status]}
          </span>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-12">
        <div className="min-h-[320px] rounded-md border border-border bg-surface-1 lg:col-span-5 lg:min-h-0">
          <Orb status={voice.state.status} thinking={voice.state.thinkingLabel !== null} />
          {voice.state.thinkingLabel && (
            <p className="pb-2 text-center text-[11px] text-faint">{voice.state.thinkingLabel}</p>
          )}
          {voice.state.errorMessage && (
            <p className="px-3 pb-3 text-center text-[11px] text-red">{voice.state.errorMessage}</p>
          )}
        </div>
        <div className="relative min-h-[320px] lg:col-span-7 lg:min-h-0">
          <ConversationPanel lines={voice.state.lines} onSend={voice.sendText} />
        </div>
      </div>

      <p className="text-[11px] leading-tight text-muted">
        Urja is read-only and grounds every answer in a tool call — it cannot approve, reject, or dispatch
        anything; those actions are directed to a Junior or Assistant Engineer.
      </p>
    </div>
  );
}
