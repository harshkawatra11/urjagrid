"use client";

import { ApiError, fetchJson, isNetworkError } from "./base";
import { fixtureNameFor, loadFixture } from "./fixtures";
import { readSession, authHeader } from "@/lib/auth";
import type { FlexPlan, PlanOverrides, ScenarioRunResult } from "./types";

export type MutationResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const P = "/api/v1";

async function post<T>(path: string, body: unknown): Promise<MutationResult<T>> {
  const session = readSession();
  try {
    const data = await fetchJson<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: authHeader(session),
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e };
    return { ok: false, error: new ApiError(0, "unknown", "Unexpected error") };
  }
}

/**
 * Offline-tolerant mutation wrapper for the Flex Plan approval workflow (SPEC step 4: human
 * approval). When the backend is unreachable (`isNetworkError`), the caller receives an
 * `offline: true` echo of the requested transition applied to the plan it already has, so the
 * JE/AE approval desk stays usable in demo-offline mode; the real transition is authoritative
 * once the backend responds.
 */
export interface PlanMutationResult {
  ok: boolean;
  offline: boolean;
  plan: FlexPlan | null;
  error?: string;
}

async function planTransition(
  planId: string,
  action: "approve" | "reject" | "cancel",
  currentPlan: FlexPlan | null,
  approverName?: string,
  notes?: string,
): Promise<PlanMutationResult> {
  const result = await post<FlexPlan>(`${P}/plans/${planId}/${action}`, { approverName, notes });
  if (result.ok) return { ok: true, offline: false, plan: result.data };
  if (isNetworkError(result.error) && currentPlan) {
    const statusByAction = { approve: "approved", reject: "rejected", cancel: "cancelled" } as const;
    const optimistic: FlexPlan = {
      ...currentPlan,
      status: statusByAction[action],
      approverName: approverName ?? currentPlan.approverName,
      approvedIso: action === "approve" ? new Date().toISOString() : currentPlan.approvedIso,
      notes: notes ?? currentPlan.notes,
    };
    return { ok: true, offline: true, plan: optimistic };
  }
  return { ok: false, offline: false, plan: null, error: result.error.detail };
}

export function approvePlan(planId: string, approverName: string, currentPlan: FlexPlan | null, notes?: string) {
  return planTransition(planId, "approve", currentPlan, approverName, notes);
}

export function rejectPlan(planId: string, approverName: string, currentPlan: FlexPlan | null, notes?: string) {
  return planTransition(planId, "reject", currentPlan, approverName, notes);
}

export function cancelPlan(planId: string, approverName: string, currentPlan: FlexPlan | null, notes?: string) {
  return planTransition(planId, "cancel", currentPlan, approverName, notes);
}

export async function simulatePlan(planId: string, overrides: PlanOverrides): Promise<MutationResult<FlexPlan>> {
  return post<FlexPlan>(`${P}/plans/${planId}/simulate`, overrides);
}

export async function refreshPlan(planId: string): Promise<MutationResult<FlexPlan>> {
  return post<FlexPlan>(`${P}/plans/${planId}/refresh`, {});
}

export async function reportOutage(dtId: string, consumerId: string, description: string): Promise<MutationResult<{ id: string }>> {
  return post<{ id: string }>(`${P}/consumers/${consumerId}/report-outage`, { dtId, description });
}

export type ScenarioRunOutcome = { ok: true; offline: boolean; result: ScenarioRunResult } | { ok: false; error: string };

/**
 * Runs a Scenario Lab preset (D22). When the backend is unreachable, falls back to the committed
 * fixture for that scenario so the lab stays demoable offline, with `offline: true` so the UI can
 * show the honest-status banner instead of pretending the number is a fresh simulation.
 */
export async function runScenario(scenarioName: string, nIntervals = 24): Promise<ScenarioRunOutcome> {
  const path = `${P}/scenario/${scenarioName}/run?n_intervals=${nIntervals}`;
  const result = await post<ScenarioRunResult>(path, {});
  if (result.ok) return { ok: true, offline: false, result: result.data };
  if (isNetworkError(result.error)) {
    const fixture = await loadFixture<ScenarioRunResult | null>(fixtureNameFor(path), null);
    if (fixture) return { ok: true, offline: true, result: fixture };
  }
  return { ok: false, error: result.error.detail };
}

export interface FieldRegistrationRequest {
  consumerId: string;
  subdivisionId: string;
  category: "critical_facility" | "life_support_home";
  notes: string;
}

/** Field-worker registration (D28). Offline-tolerant: on network failure, returns an optimistic
 * unverified row so the field app stays usable without connectivity, mirroring `planTransition`. */
export async function registerFieldEntry(body: FieldRegistrationRequest): Promise<MutationResult<{ id: string; verified: boolean }>> {
  const result = await post<{ id: string; verified: boolean }>(`${P}/field/registry`, body);
  if (result.ok) return result;
  if (isNetworkError(result.error)) {
    return { ok: true, data: { id: `offline_${Date.now()}`, verified: false } };
  }
  return result;
}

export async function submitOutageReport(
  subdivisionId: string,
  description: string,
  dtId?: string,
  consumerId?: string,
): Promise<MutationResult<{ id: string }>> {
  const result = await post<{ id: string }>(`${P}/field/outages`, { subdivisionId, description, dtId, consumerId });
  if (result.ok) return result;
  if (isNetworkError(result.error)) {
    return { ok: true, data: { id: `offline_${Date.now()}` } };
  }
  return result;
}
