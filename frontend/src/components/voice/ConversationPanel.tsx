"use client";

import { useState } from "react";
import { FactCard } from "./FactCard";
import type { TranscriptLine } from "@/lib/voice/protocol";

export function ConversationPanel({ lines, onSend }: { lines: TranscriptLine[]; onSend: (body: string) => void }) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-surface-1">
      <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-label="Conversation" role="log">
        {lines.length === 0 && <p className="text-[12px] text-faint">Ask Urja about any sub-division, transformer, or plan.</p>}
        {lines.map((line) => (
          <div key={line.id} className={line.speaker === "assistant" ? "" : "text-right"}>
            <p
              className={
                line.speaker === "assistant"
                  ? "inline-block max-w-[90%] rounded-md bg-surface-2 px-3 py-1.5 text-left text-[12px] text-text"
                  : "inline-block max-w-[90%] rounded-md bg-brand-soft px-3 py-1.5 text-[12px] text-text"
              }
            >
              {line.text}
            </p>
            {line.cards.length > 0 && (
              <div className="mt-2 space-y-2 text-left">
                {line.cards.map((card, i) => (
                  <FactCard key={`${line.id}-${i}`} card={card} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Urja…"
          aria-label="Message"
          className="h-9 flex-1 rounded-md border border-border bg-surface-1 px-2 text-[12px]"
        />
        <button type="submit" className="h-9 rounded-md bg-brand px-3 text-[12px] font-medium text-black">
          Send
        </button>
      </form>
    </div>
  );
}
