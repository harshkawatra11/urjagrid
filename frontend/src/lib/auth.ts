import type { Role } from "@/lib/roleContext";
import type { Scope } from "@/lib/scope";

/** JWT session shape returned by POST /api/v1/auth/demo-login and /auth/login. */
export interface Session {
  token: string;
  role: Role;
  subdivisionId: Scope | null;
  displayName: string;
  expiresAt: string;
}

const SESSION_KEY = "llg-session";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearSession(): void {
  writeSession(null);
}

export interface DemoLoginRequest {
  role: Role;
  subdivisionId?: Scope;
}

export type DemoLoginResult = { ok: true; session: Session } | { ok: false; error: string };

/**
 * Calls the backend demo-login endpoint (Lane B contract: POST /api/v1/auth/demo-login).
 * The backend may not exist yet (or be unreachable); on any network/parse failure this
 * resolves to `{ ok: false }` rather than throwing, so callers can fall back to an offline
 * demo session.
 */
export async function demoLogin(role: Role, subdivisionId?: Scope): Promise<DemoLoginResult> {
  const body: DemoLoginRequest = { role, subdivisionId };
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `demo-login failed with status ${res.status}` };
    }
    const session = (await res.json()) as Session;
    writeSession(session);
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/** Offline fallback session used when the backend is unreachable, for demo continuity. */
export function offlineDemoSession(role: Role, subdivisionId?: Scope): Session {
  const session: Session = {
    token: "offline-demo-token",
    role,
    subdivisionId: subdivisionId ?? null,
    displayName: `Offline ${role} demo`,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };
  writeSession(session);
  return session;
}

export function authHeader(session: Session | null): Record<string, string> {
  if (!session) return {};
  return { Authorization: `Bearer ${session.token}` };
}
