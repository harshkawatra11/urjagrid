import { describe, expect, it, vi } from "vitest";
import { VoiceClient, type SocketLike } from "./client";

class FakeSocket implements SocketLike {
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  emit(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

describe("VoiceClient", () => {
  it("starts idle and moves to connecting then connected on a ready frame", () => {
    let socket: FakeSocket | null = null;
    const client = new VoiceClient({
      createSocket: () => {
        socket = new FakeSocket();
        return socket;
      },
      url: () => "ws://test/ws/voice",
    });
    expect(client.getState().status).toBe("idle");
    client.connect();
    expect(client.getState().status).toBe("connecting");
    socket!.open();
    socket!.emit({ t: "ready", sessionId: "s1" });
    expect(client.getState().status).toBe("connected");
  });

  it("sendText appends an operator line and emits a hello/text frame", () => {
    let socket: FakeSocket | null = null;
    const client = new VoiceClient({
      createSocket: () => {
        socket = new FakeSocket();
        return socket;
      },
      url: () => "ws://test/ws/voice",
    });
    client.connect();
    socket!.open();
    socket!.emit({ t: "ready" });
    client.sendText("How is Krishna Nagar doing?");
    expect(client.getState().lines).toHaveLength(1);
    expect(client.getState().lines[0].speaker).toBe("operator");
    expect(socket!.sent.some((s) => JSON.parse(s).t === "text")).toBe(true);
  });

  it("appends an assistant line with cards on a reply frame", () => {
    let socket: FakeSocket | null = null;
    const client = new VoiceClient({
      createSocket: () => {
        socket = new FakeSocket();
        return socket;
      },
      url: () => "ws://test/ws/voice",
    });
    client.connect();
    socket!.open();
    socket!.emit({ t: "ready" });
    socket!.emit({
      t: "reply",
      turnId: "turn1",
      text: "Krishna Nagar is critical.",
      cards: [{ type: "subdivision", id: "sd_krishnanagar", name: "Krishna Nagar", riskLevel: "critical", riskIndex: 0.9, servedFraction: 0.8, activePlanCount: 2 }],
    });
    const lines = client.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].speaker).toBe("assistant");
    expect(lines[0].cards).toHaveLength(1);
  });

  it("goes to failed, not throwing, when the socket constructor throws (no backend)", () => {
    const client = new VoiceClient({
      createSocket: () => {
        throw new Error("ECONNREFUSED");
      },
      url: () => "ws://test/ws/voice",
    });
    expect(() => client.connect()).not.toThrow();
    expect(client.getState().status).toBe("failed");
    expect(client.getState().errorMessage).toContain("ECONNREFUSED");
  });

  it("disconnect closes the socket and returns to idle", () => {
    let socket: FakeSocket | null = null;
    const client = new VoiceClient({
      createSocket: () => {
        socket = new FakeSocket();
        return socket;
      },
      url: () => "ws://test/ws/voice",
    });
    client.connect();
    socket!.open();
    client.disconnect();
    expect(client.getState().status).toBe("idle");
  });

  it("notifies subscribers on state changes", () => {
    const listener = vi.fn();
    let socket: FakeSocket | null = null;
    const client = new VoiceClient({
      createSocket: () => {
        socket = new FakeSocket();
        return socket;
      },
      url: () => "ws://test/ws/voice",
    });
    const unsubscribe = client.subscribe(listener);
    client.connect();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    socket!.open();
    const callsAfterUnsubscribe = listener.mock.calls.length;
    socket!.emit({ t: "ready" });
    expect(listener.mock.calls.length).toBe(callsAfterUnsubscribe);
  });
});
