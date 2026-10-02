# LifelineGrid — Design Artifacts

The hackathon brief asks for "supporting design artifacts" (deliverable 3) as something separate from the software prototype (deliverable 4). For LifelineGrid, we are not fabricating wireframe images or mockups that don't exist just to tick that box. **The working application is the design artifact** — every screen, data model, and API contract below was actually built, not sketched. This document points to exactly where each one lives.

## 1. The UX design artifact: 28 real dashboard/standalone pages

Rather than a Figma file we cannot produce here, the primary UX design artifact is the actual, running information architecture: 29 `page.tsx` files under `frontend/src/app/` (28 distinct routes plus the root redirect), one per role-and-task combination defined in `docs/SPEC.md` section 8:

- Control-room surfaces: `/command`, `/voice`, `/flex` and its sub-pages (`/flex/chargers`, `/flex/storage`, `/flex/dr`, `/flex/lifeline`)
- Planning/decision surfaces: `/plans`, `/plans/[planId]`
- Asset/network surfaces: `/subdivisions`, `/subdivisions/[id]`, `/transformers`, `/transformers/[dtId]`, `/map`, `/feeders`
- Analysis surfaces: `/forecast`, `/reliability`, `/thermal`, `/power-quality`, `/analytics`, `/economics`, `/scenario`
- Governance/registry surfaces: `/critical`, `/consumers`, `/protocols`, `/regulator`
- Field/consumer-facing surfaces: `/consumer`, `/field`

Every page follows one documented recipe (`docs/SPEC.md` section 8): a `page.tsx` that renders one view component, built on `useScope` + data hooks, a 12-column grid, a `PanelSkeleton` while loading, `titles.ts` for action-oriented page titles, a test file, and committed offline-fixture JSON so the page renders identically with the backend unreachable. The acceptance bar for every page (also in the spec) was: at least 8 data cards, at least 3 chart types, at least one heatmap/matrix, one "moneyshot" number, a unique visual silhouette (no two pages look alike), and scope-reactivity (every page responds to the sub-division scope selector).

The reusable design-system layer backing all 28 pages lives in `frontend/src/components/ds/` (chips, `StatusTag` for the LIVE/WIRED/PILOT labels, `Delta`, `CompareStat`, heat scales), `frontend/src/components/charts/` (FanChart, SupplyDemandChart, LeverWaterfall, LorenzCurve, GaugeArc, HourHeatmap, CompareBars, ThermalTrace, StepLine), `frontend/src/components/map/` (Leaflet service-area/feeder/DT/asset layers), and `frontend/src/components/grid/` (MeterWall, SingleLineDiagram, LeverStack, PlanCard, OptionsTable, DispatchStepper, DecisionBar, WhatIfPanel, SensitivityMatrix, EventTimeline, ProtocolMessage, SituationBanner) — this is the component library a design system document would otherwise describe in the abstract; here it is the actual, typed, tested code.

**What we could not produce:** real browser screenshots. No hosted browser session was available while building these deliverables, so `README.md` section 5 lists exactly what to capture from a live run instead of including fabricated image links.

## 2. The data-model design artifact: `backend/app/grid/models.py`

The cross-lane contract — what a "Flex Plan," a "DT," a "Plan Status," or a "Risk Level" *is*, down to the exact string value — is defined once, as real Pydantic models and enums, in `backend/app/grid/models.py`:

- **Enums**: `RiskLevel` (low/medium/high/critical), `PlanStatus` (draft/approved/rejected/cancelled/dispatched/completed/expired — the actual Flex Plan state machine), `MeterState` (normal/dr_active/capped/shed/critical_backup), `LeverKey` (dr/hub/shift/... — matching `LEVER_ORDER` exactly), `CapLevel` (0 None → 3 Lifeline).
- **Value objects**: `Actions` (the per-interval control vector: cap_kw, cap_started, dr_on, hub_frac, storage_kw, shift_on), `IntervalResult`, `LogRow`, `ForecastBundle`, `PlanInputs`/`PlanSolution` (the MILP optimiser's input/output contract), `PlanOverrides` (what-if overrides), `FlexPlan` (the persisted, wire-level plan object).

This file is deliberately framework-agnostic (plain `list[float]`, not numpy arrays, at the wire boundary) specifically so it can double as the data-model diagram a design document would otherwise hand-draw: every entity name here is imported verbatim by the engines that produce it, the API that serves it, the frontend TypeScript types that consume it (`frontend/src/lib/types.ts`), and the LLM tool schemas that describe it to the voice/chat agent (`backend/app/tools/schemas.py`). One real file, one source of truth, instead of a diagram that can drift from the code.

## 3. The service-design artifact: the real API contract

`backend/app/api/v1/` is the actual REST surface, one module per resource area: `grid.py`, `plans.py`, `flex.py`, `forecast.py`, `consumers.py`, `field.py`, `protocols.py`, `scenario.py`, `economics.py`, `openadr.py`, `insights.py`, `admin.py`, `auth.py`, `stream.py` — plus the SSE stream (`/api/v1/stream`, event types `tick`/`event`/`plan`/`plans`/`risk`/`kpis`) and the voice WebSocket (`/ws/voice`). `backend/app/grid/views.py` is the pure, JSON-ready read-model layer every one of these endpoints serves from, mirrored exactly by the frontend's TypeScript types — this is the service-design document, expressed as code that cannot drift out of sync with what actually runs, rather than an OpenAPI mockup drawn separately from the implementation.

## 4. Why we chose real code over fabricated mockups

A diagram of a screen that doesn't exist, or a data model that doesn't match the code, would actively mislead a judge evaluating this submission against the "software prototype" deliverable (4) and the honesty requirement running through the whole brief (the LIVE/WIRED/PILOT matrix exists for exactly this reason). Deliverable 3 ("supporting design artifacts") and deliverable 4 ("a software prototype") are, for this submission, the same artifact viewed two ways: the design is legible directly from `frontend/src/app/`, `backend/app/grid/models.py`, and `backend/app/api/v1/`, and every claim in this document can be checked by opening those files.
