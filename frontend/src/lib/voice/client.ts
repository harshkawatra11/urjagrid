import {
  defaultVoiceUrl,
  type ClientFrame,
  type ServerFrame,
  type TranscriptLine,
  type VoiceLanguage,
  type VoiceMode,
} from "./protocol";

export type VoiceStatus = "idle" | "connecting" | "connected" | "failed";

export interface VoiceState {
  status: VoiceStatus;
  thinkingLabel: string | null;
  lines: TranscriptLine[];
  language: VoiceLanguage;
  mode: VoiceMode;
  errorMessage: string | null;
}

/** The subset of WebSocket the client uses (lets tests inject a fake). */
export interface SocketLike {
  readyState: number;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface VoiceDeps {
  createSocket(url: string): SocketLike;
  url(): string;
}

const OPEN = 1;
export const CONNECT_TIMEOUT_MS = 8000;

export function defaultDeps(): VoiceDeps {
  return {
    createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
    url: () =>
      defaultVoiceUrl(
        { apiBase: process.env.NEXT_PUBLIC_API_BASE },
        typeof window === "undefined" ? undefined : window.location,
      ),
  };
}

function initialState(language: VoiceLanguage, mode: VoiceMode): VoiceState {
  return { status: "idle", thinkingLabel: null, lines: [], language, mode, errorMessage: null };
}

/**
 * Text-first voice client against GET /ws/voice (SPEC task B12). Framework free (plain class with
 * a subscribe/publish surface, like `LiveStream`) so it can be unit tested with a fake socket and
 * degrades to `status: "failed"` -- never throws -- when the backend/WS endpoint is unreachable.
 * Audio capture/playback is deliberately out of scope here; Lane D's /voice page renders text
 * turns and fact cards, which is what this client produces.
 */
export class VoiceClient {
  private socket: SocketLike | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private state: VoiceState;
  private readonly listeners = new Set<() => void>();
  private clientTurnCounter = 0;

  constructor(private readonly deps: VoiceDeps = defaultDeps(), language: VoiceLanguage = "auto", mode: VoiceMode = "handsfree") {
    this.state = initialState(language, mode);
  }

  getState = (): VoiceState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  connect(scope: string | null = null): void {
    if (this.socket) return;
    this.setState({ status: "connecting", errorMessage: null });
    let socket: SocketLike;
    try {
      socket = this.deps.createSocket(this.deps.url());
    } catch (e) {
      this.setState({ status: "failed", errorMessage: e instanceof Error ? e.message : "connect failed" });
      return;
    }
    this.socket = socket;
    this.connectTimer = setTimeout(() => {
      if (this.state.status === "connecting") {
        this.setState({ status: "failed", errorMessage: "Connection timed out" });
        this.disconnect();
      }
    }, CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.sendFrame({ t: "hello", language: this.state.language, scope, mode: this.state.mode, protocol: 1 });
    };
    socket.onmessage = (ev) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(ev.data) as ServerFrame;
      } catch {
        return;
      }
      this.onFrame(frame);
    };
    socket.onerror = () => {
      this.setState({ status: "failed", errorMessage: "Voice connection error" });
    };
    socket.onclose = () => {
      this.socket = null;
      if (this.state.status !== "failed") this.setState({ status: "idle" });
    };
  }

  disconnect(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setState({ status: "idle", thinkingLabel: null });
  }

  setLanguage(language: VoiceLanguage): void {
    this.setState({ language });
  }

  setMode(mode: VoiceMode): void {
    this.setState({ mode });
  }

  /** Sends a typed query. Returns the client turn id used to correlate the reply. */
  sendText(body: string): string {
    const clientTurnId = `t${++this.clientTurnCounter}`;
    const line: TranscriptLine = {
      id: clientTurnId,
      speaker: "operator",
      text: body,
      cards: [],
      trace: [],
      turnId: null,
      clientTurnId,
      streaming: false,
    };
    this.setState({ lines: [...this.state.lines, line] });
    this.sendFrame({ t: "text", body, clientTurnId });
    return clientTurnId;
  }

  private sendFrame(frame: ClientFrame): void {
    if (!this.socket || this.socket.readyState !== OPEN) return;
    this.socket.send(JSON.stringify(frame));
  }

  private onFrame(frame: ServerFrame): void {
    switch (frame.t) {
      case "ready":
        this.setState({ status: "connected" });
        return;
      case "thinking":
        this.setState({ thinkingLabel: frame.label });
        return;
      case "tool":
        return;
      case "reply": {
        const line: TranscriptLine = {
          id: frame.turnId,
          speaker: "assistant",
          text: frame.text,
          cards: frame.cards ?? [],
          trace: (frame.toolCalls ?? []).map((name) => ({ name, label: name, ok: true })),
          turnId: frame.turnId,
          clientTurnId: null,
          streaming: false,
        };
        this.setState({ lines: [...this.state.lines, line], thinkingLabel: null });
        return;
      }
      case "turn_end":
        this.setState({ thinkingLabel: null });
        return;
      case "error":
        this.setState({ errorMessage: frame.message, status: frame.fatal ? "failed" : this.state.status });
        return;
      case "final":
        return;
    }
  }
}
