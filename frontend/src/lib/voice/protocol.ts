/** Wire protocol for /ws/voice (SPEC section 10, task B12). The client speaks only this shape. */
import type { LeverKey, PlanStatus, RiskLevel } from "@/lib/domain";

export type VoiceLanguage = "auto" | "en-IN" | "hi-IN";
export type VoiceMode = "handsfree" | "ptt";

/**
 * The 12 UrjaGrid fact-card types "Urja" (the voice persona) can ground an answer in. Every
 * card cites a tool call (SPEC section 10: "grounds every fact in a tool call, never fabricates"),
 * so cards are the UI surface for that honesty rule, not just a formatting convenience.
 */
export type FactCard =
  | {
      type: "circle_summary";
      discom: "MVVNL" | "DVVNL" | "all";
      subdivisionCount: number;
      riskCounts: Partial<Record<RiskLevel, number>>;
      servedFraction: number;
    }
  | {
      type: "subdivision";
      id: string;
      name: string;
      riskLevel: RiskLevel;
      riskIndex: number;
      servedFraction: number;
      activePlanCount: number;
    }
  | {
      type: "transformer";
      id: string;
      name: string;
      loadingPu: number;
      hotspotC: number;
      riskLevel: RiskLevel;
    }
  | {
      type: "deficits";
      rows: { dtId: string; dtName: string; gapKw: number; startIso: string }[];
    }
  | {
      type: "ranking";
      metric: string;
      unit: string;
      rows: { id: string; name: string; value: number }[];
    }
  | {
      type: "plans";
      rows: { id: string; subdivisionName: string; status: PlanStatus; gapKw: number; coveredKw: number }[];
    }
  | {
      type: "plan";
      id: string;
      status: PlanStatus;
      gapKw: number;
      coveredKw: number;
      levers: { lever: LeverKey; reliefKw: number }[];
    }
  | {
      type: "levers";
      rows: { lever: LeverKey; reliefKw: number; costRs: number }[];
    }
  | {
      type: "critical";
      rows: { id: string; name: string; kind: string; backupAvailable: boolean }[];
    }
  | {
      type: "reliability";
      saidiMinutes: number;
      saifiCount: number;
      lifelineAvailabilityPct: number;
    }
  | {
      type: "forecast";
      dtName: string;
      p50NextHourKw: number;
      gapKw: number | null;
    }
  | {
      type: "fairness";
      jainIndex: number;
      giniCoefficient: number;
    };

export interface TurnMetrics {
  finalToFirstTokenMs?: number | null;
  totalMs?: number | null;
  tools?: string[];
}

/** Server -> client frames. Audio/STT streaming frames are out of scope for this text-first client. */
export type ServerFrame =
  | { t: "ready"; sessionId?: string; protocol?: number }
  | { t: "final"; text: string; turnId: string; language?: string; clientTurnId?: string }
  | { t: "thinking"; turnId: string; stage: "planning" | "tools" | "answering"; label: string }
  | { t: "tool"; turnId: string; name: string; label: string; ok: boolean }
  | { t: "reply"; turnId: string; text: string; toolCalls?: string[]; cards?: FactCard[]; language?: string }
  | { t: "turn_end"; turnId: string; metrics?: TurnMetrics }
  | { t: "error"; message: string; fatal?: boolean; code?: string };

/** Client -> server frames. */
export type ClientFrame =
  | { t: "hello"; language: VoiceLanguage; scope: string | null; mode: VoiceMode; protocol: 1 }
  | { t: "text"; body: string; clientTurnId: string }
  | { t: "context"; scope: string | null; dtId?: string | null }
  | { t: "bye" };

export interface TraceItem {
  name: string;
  label: string;
  ok: boolean;
}

export interface TranscriptLine {
  id: string;
  speaker: "assistant" | "operator";
  text: string;
  cards: FactCard[];
  trace: TraceItem[];
  turnId: string | null;
  clientTurnId: string | null;
  streaming: boolean;
}

/** The websocket URL. Never "localhost": a browser WebSocket does not fall back from ::1 to IPv4. */
export function defaultVoiceUrl(
  env: { voiceUrl?: string; apiBase?: string } = {},
  loc?: { protocol: string; hostname: string },
): string {
  if (env.voiceUrl) return env.voiceUrl;
  if (env.apiBase) {
    const base = env.apiBase.replace(/\/+$/, "").replace(/^http/, "ws").replace("//localhost", "//127.0.0.1");
    return `${base}/ws/voice`;
  }
  if (!loc) return "ws://127.0.0.1:8080/ws/voice";
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  const host = loc.hostname === "localhost" ? "127.0.0.1" : loc.hostname;
  return `${proto}//${host}:8080/ws/voice`;
}
