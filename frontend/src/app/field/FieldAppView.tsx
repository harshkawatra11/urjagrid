"use client";

import { useState } from "react";
import { useRole } from "@/lib/roleContext";
import { useScope, SUBDIVISION_IDS, SUBDIVISION_LABEL } from "@/lib/scope";
import { useFieldRegistry, useOutageReports } from "@/lib/api/hooks";
import { registerFieldEntry, submitOutageReport } from "@/lib/api/mutations";
import { Card } from "@/components/ds/Card";
import { PanelSkeleton } from "@/components/ds/Skeleton";
import { OfflineBanner } from "@/components/ds/OfflineBanner";
import { formatIstDateTime } from "@/lib/format";
import { canUseFieldApp, outageTitle, registryTitle } from "./titles";

export function FieldAppView() {
  const { role, setRole } = useRole();
  const { scope, setScope } = useScope();
  const { data: registryData, isLoading, offline, mutate: mutateRegistry } = useFieldRegistry(scope);
  const { data: outageData, mutate: mutateOutages } = useOutageReports(scope);
  const registrations = registryData?.registrations ?? [];
  const reports = outageData?.reports ?? [];

  const [consumerId, setConsumerId] = useState("");
  const [category, setCategory] = useState<"critical_facility" | "life_support_home">("life_support_home");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [registerResult, setRegisterResult] = useState<string | null>(null);

  const [outageDescription, setOutageDescription] = useState("");
  const [outageResult, setOutageResult] = useState<string | null>(null);

  if (!canUseFieldApp(role)) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[18px] font-semibold text-text">Field Worker App</h1>
        <Card title="Access restricted" eyebrow="Role gate">
          <p className="text-[12px] text-muted">
            This app is for field workers, Assistant Engineers, and demo operators only. Switch role to continue.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setRole("field")} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black">
              Continue as field worker (demo)
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading && registrations.length === 0) {
    return (
      <div>
        <h1 className="mb-3 text-[18px] font-semibold text-text">Field Worker App</h1>
        <PanelSkeleton />
      </div>
    );
  }

  async function submitRegistration() {
    if (!consumerId || !consent) return;
    const result = await registerFieldEntry({ consumerId, subdivisionId: scope === "all" ? SUBDIVISION_IDS[0] : scope, category, notes });
    setRegisterResult(result.ok ? `Registered (${result.data.verified ? "verified" : "pending verification"}).` : "Registration failed — try again.");
    if (result.ok) {
      setConsumerId("");
      setNotes("");
      setConsent(false);
      void mutateRegistry();
    }
  }

  async function submitOutage() {
    if (!outageDescription) return;
    const result = await submitOutageReport(scope === "all" ? SUBDIVISION_IDS[0] : scope, outageDescription);
    setOutageResult(result.ok ? "Outage report submitted." : "Submission failed — try again.");
    if (result.ok) {
      setOutageDescription("");
      void mutateOutages();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {offline && <OfflineBanner />}
      <header>
        <p className="text-[11px] uppercase tracking-[0.1em] text-faint">UrjaGrid</p>
        <h1 className="text-[18px] font-semibold text-text">Field Worker App</h1>
        <label className="mt-2 flex flex-col gap-1 text-[12px]">
          <span className="text-muted">Sub-division</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]">
            <option value="all">All</option>
            {SUBDIVISION_IDS.map((id) => (
              <option key={id} value={id}>
                {SUBDIVISION_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <Card title="Register life-support home / critical facility" eyebrow="Registry form">
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Consumer ID</span>
            <input
              value={consumerId}
              onChange={(e) => setConsumerId(e.target.value)}
              placeholder="e.g. c_sn_01_0040"
              className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="h-8 rounded-md border border-border bg-surface-1 px-2 text-[12px]">
              <option value="life_support_home">Life-support home</option>
              <option value="critical_facility">Critical facility</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-16 rounded-md border border-border bg-surface-1 p-2 text-[12px]" />
          </label>
          <label className="flex items-start gap-2 text-[12px] text-text">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>I have explained T0 status to the resident/facility owner and they consent to being registered as never-capped, never-shed.</span>
          </label>
          <button
            type="button"
            disabled={!consumerId || !consent}
            onClick={submitRegistration}
            className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40"
          >
            Submit registration
          </button>
          {registerResult && <p className="text-[12px] text-muted">{registerResult}</p>}
        </div>
      </Card>

      <Card title={registryTitle(registrations.length)} eyebrow="Registry">
        <ul className="space-y-2">
          {registrations.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2 text-[12px]">
              <p className="text-text">{r.consumerId} · {r.category.replace("_", " ")}</p>
              <p className="text-faint">{formatIstDateTime(r.createdIso)} · {r.verified ? "verified" : "pending verification"} · by {r.registeredBy}</p>
            </li>
          ))}
          {registrations.length === 0 && <p className="text-[11px] text-faint">No registrations in scope.</p>}
        </ul>
      </Card>

      <Card title="Report an outage" eyebrow="Outage form">
        <div className="flex flex-col gap-2">
          <textarea
            value={outageDescription}
            onChange={(e) => setOutageDescription(e.target.value)}
            placeholder="Describe what you're seeing in the field..."
            className="h-16 rounded-md border border-border bg-surface-1 p-2 text-[12px]"
          />
          <button type="button" disabled={!outageDescription} onClick={submitOutage} className="h-8 rounded-md bg-brand px-3 text-[12px] font-medium text-black disabled:opacity-40">
            Submit outage report
          </button>
          {outageResult && <p className="text-[12px] text-muted">{outageResult}</p>}
        </div>
      </Card>

      <Card title={outageTitle(reports.length)} eyebrow="Outage list">
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2 text-[12px]">
              <p className="text-text">{r.description}</p>
              <p className="text-faint">{formatIstDateTime(r.createdIso)} · {r.status}</p>
            </li>
          ))}
          {reports.length === 0 && <p className="text-[11px] text-faint">No outage reports in scope.</p>}
        </ul>
      </Card>
    </div>
  );
}
