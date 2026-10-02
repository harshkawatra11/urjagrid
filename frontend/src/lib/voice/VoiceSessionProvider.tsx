"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { VoiceClient, type VoiceState } from "./client";
import type { VoiceLanguage, VoiceMode } from "./protocol";

export interface VoiceSession {
  state: VoiceState;
  connect: (scope?: string | null) => void;
  disconnect: () => void;
  sendText: (body: string) => string;
  setLanguage: (language: VoiceLanguage) => void;
  setMode: (mode: VoiceMode) => void;
}

const VoiceContext = createContext<VoiceSession | null>(null);

export function VoiceSessionProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => new VoiceClient(), []);
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);

  const value = useMemo<VoiceSession>(
    () => ({
      state,
      connect: (scope) => client.connect(scope ?? null),
      disconnect: () => client.disconnect(),
      sendText: (body) => client.sendText(body),
      setLanguage: (language) => client.setLanguage(language),
      setMode: (mode) => client.setMode(mode),
    }),
    [client, state],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceSession {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within a VoiceSessionProvider");
  return ctx;
}
