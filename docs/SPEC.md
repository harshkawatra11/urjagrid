# LifelineGrid — Condensed Technical Specification

(Source: brainstorm.txt, lines 1237-21956, "Part 1: Product Definition" through "Appendix B: Sources", plus Part 0 "Global Constraints" at lines 1060-1236.)

## 1. Product Definition

**LifelineGrid** is a software-only decision layer sitting between a DISCOM's existing smart-metering/head-end system (HES/MDM) and its sub-division engineers. Tagline: "Brownout, never blackout." Voice persona: **Urja**. Product name is one word ("LifelineGrid"); "Lifeline Grid" never appears in code/UI.

Every hour it forecasts, per distribution transformer (DT), demand and available supply for the next 36 hours. When it detects a shortfall or thermal overload, it builds a **Flex Plan**: ask willing households to shift load (bill rebate), slow public EV/e-rickshaw charging, discharge existing storage, and only as a last resort limit each home to a guaranteed **lifeline wattage** -- never a full blackout -- before falling back to rotational feeder shedding. A named **Junior Engineer (JE)** must approve, edit, or reject each plan. Approved plans dispatch as Hindi notices (2 hrs ahead) and time-boxed commands to meters/chargers. After the window, meter readings verify realised relief, rebates settle, and a fairness ledger rotates the burden.

**Closed loop (7 steps, human at step 4):** Sense (data adapters) -> Forecast (engines) -> Propose (optimiser) -> **Approve (human, JE/AE)** -> Dispatch (dispatcher) -> Confirm (M&V) -> Learn (models).

**Lever order (always tried in this sequence):** L1 Behavioural DR (WhatsApp/IVR ask + Rs 2/kWh rebate) -> L2 Managed charging (OCPP SetChargingProfile to e-rickshaw/EV hubs) -> L3 Shiftable public loads (OpenADR to water pumps/telecom towers) -> L4 Existing storage discharge -> L5 Lifeline caps (DLMS load-limit via HES, per DT, with expiry) -> L6 Status quo / rotational shedding (last resort only).

**Tiers:** T0 critical facilities + life-support homes (never capped/asked/shed) - T1 households (lifeline guarantee >=300 W) - T2 livelihood/shops (>=500 W) - T3 flexible assets (shifted first). **Cap levels:** 0 None - 1 Comfort (1000W/2000W) - 2 Essential (500/1000W) - 3 Lifeline (300/500W for T1/T2).

**Users/roles (auth role -> surface -> job):**
- Household/shop (`consumer`) -> `/consumer` phone app, WhatsApp/IVR -> see "bijli mausam", accept DR, report outage
- Field worker/lineman (`field`) -> `/field` mobile -> register life-support homes/critical facilities, verify outages
- Junior Engineer (`je`) -> Dashboard, `/plans` -> approve/edit/reject plans for own sub-division
- Assistant Engineer (`ae`) -> Dashboard -> cross-sub-division approval, watch transformer health
- DISCOM control room (`ae`) -> `/flex`, `/voice` -> watch live ops, ask Urja
- Regulator (`regulator`) -> `/regulator` -> aggregates only (flexibility, fairness, reliability)
- Demo operator (`admin`) -> sim clock/scenario controls

**Geography (real places, simulated network):** Uttar Pradesh -> 2 DISCOMs (MVVNL, DVVNL) -> 2 towns (Bareilly, Mathura) -> 5 sub-divisions (scope unit) -> 12 feeders (11kV) -> 48 DTs -> ~7,000 consumers. Sub-divisions: sd_subhashnagar, sd_izzatnagar, sd_faridpur (Bareilly/MVVNL), sd_krishnanagar, sd_kosikalan (Mathura/DVVNL). ID conventions: DT `dt_sn_01`, feeder `fdr_sn_a`, consumer `c_sn_01_0007`, plan `fp_<8hex>`, deficit window `dw_<8hex>`.

**Honest status matrix** (must be used verbatim as UI tags): **LIVE** = real algorithm/external service runs in prototype (weather, load shapes, net-load forecast, thermal model, LV power flow, optimiser, shadow baseline, voice, typed-ask agent, auth). **WIRED** = spec-shaped code path against an in-process simulator, not real hardware (OCPP, OpenADR, DLMS/HES, Beckn/UEI, WhatsApp/IVR/SMS, federation). **PILOT** = not built (real HES/MDM integration, India Energy Stack consent, production messaging).

## 2. System Architecture

**Component diagram:**
- **People**: Household/shop (WhatsApp, IVR, /consumer), Field worker (/field), JE/AE (Dashboard), Regulator (/regulator)
- **Frontend** (Next.js 16 on Vercel): 26 dashboard pages, Voice Control Room + orb, Consumer phone app
- **Backend** (FastAPI on Cloud Run): REST `/api/v1`, SSE `/api/v1/stream`, WS `/ws/voice`; **Engines** (Load model, Quantile forecaster, Thermal model, LV power flow, Deficit detector, MILP optimiser, Shadow baseline, Fairness ledger, Metrics/M&V); **GridService** (sim clock/tick/state store); **FlexPlanService** (state machine); **Dispatcher**; 15 read-only **Tools**
- **Adapters**: HES gateway (DLMS load limit), OCPP 1.6J gateway, OpenADR 3 VTN, Beckn/UEI, Channels (WhatsApp/IVR/SMS), Protocol ledger
- **External**: Open-Meteo, Sarvam AI, Gemini

**Three flows:**
- **Data flow**: Meters -> HES/MDM -> adapters -> engines -> Flex Plan -> JE approval -> dispatcher -> HES/chargers/OpenADR/channels -> interval reads -> M&V -> models. Consumer-level data never leaves the DISCOM node; regulator view gets aggregates only.
- **Energy flow**: Upstream supply (firm + renewable) -> 33/11kV substation -> 11kV feeder -> DT -> LV network -> homes/shops/chargers/pumps/towers. Rooftop solar/storage inject at LV side. In deficit, plan reduces kW at chargers/shiftable loads/capped meters to fit available supply and each DT's thermal limit.
- **Money flow**: DISCOM pays per-meter monthly software fee. Consumers pay nothing. DR participants get bill rebates (Rs 2/kWh shifted). DISCOM gains: revenue from energy that would've been shed, fewer DT failures, deferred upgrades, better reliability indices. Field workers paid per verified registration.

**Runtime model**: Single process, one `GridService`, one tick loop (1 real second). `LIFELINE_TIME_SCALE` sim-seconds pass per real second (default 60 -> one 15-min interval every 15 real seconds). Each tick advances clock; on interval boundary crossing calls `world.advance_interval()`; publishes tick frame with interpolated DT loads. Each interval: demand, plan actions, served power, thermal, power flow, metrics for both solution world and shadow baseline. Each sim hour: re-forecast, detect deficits, build/refresh plans, expire stale plans. State persisted to JSON (`.runtime/grid_state.json`) when dirty, max every 5 real seconds; on Cloud Run world restarts from scenario start on cold start (documented limitation).

**Repo layout**: `backend/app/{core,api/v1,grid,adapters,services,tools,agents,prompts,voice}`, `backend/data/{weather,scenarios,models}`, `backend/scripts/`, `backend/evals/`, `backend/tests/`; `frontend/src/{app,components,lib,data/fixtures}`; `docs/`, `deliverables/{deck,video}`.

**Lanes (own folders, run in parallel after A1-A3):** Lane A (Data/engines, A1-A14, owns `grid/` engines + `data/` + `scripts/`), Lane B (Service/API/adapters/voice, B1-B14, owns `world/service/planner/dispatch/stream.py`, `adapters/`, `api/`, `tools/`, `voice/`), Lane C (Frontend foundation, C1-C9, owns scaffolding/lib/ds/charts/map/grid components), Lane D (Frontend pages, D1-D28, owns every route), Lane E (Deliverables, E1-E9). Cross-lane contract = Pydantic models (Task A2) + API contract (Part 4/B9).

## 3. Tech Stack

**Backend**: Python 3.12 (`py -3.12`, not bare `python`/3.14), FastAPI >=0.115, uvicorn, Pydantic >=2.9/pydantic-settings, `google-genai` (Gemini, typed Ask agent), `tenacity`, `httpx`, `websockets`, `sse-starlette`, `rapidfuzz` (fuzzy name resolution), `pyyaml`, `numpy`/`scipy`, `lightgbm` (quantile forecaster -- needs `libgomp1` in Docker), `PyJWT`+`bcrypt` (auth), `jsonschema` (OCPP schema validation). MILP solved via **HiGHS** (via scipy or direct), greedy fallback. Dev: pytest, ruff (line-length 100), pandas.
**Frontend**: Next.js 16 (App Router) on Vercel, TypeScript strict/no-any, Vitest + Playwright (e2e), Leaflet/react-leaflet (maps), Recharts (charts). Design system and most generic scaffolding copied verbatim from reference repo (`C:\Users\harsh\Desktop\HARSH\WEB-DEV-PROJECTS\ai-healthcare platform`, "$SG"/SwasthyaGrid) then adapted.
**Deploy**: Backend -> Google Cloud Run (Docker, port 8080, 1 GiB free tier). Frontend -> Vercel. Model artifacts (LightGBM `.txt` files) committed to `backend/data/models/`.
**External services**: Open-Meteo (historical weather), Sarvam AI (STT `saaras:v3-realtime`, chat `sarvam-105b-conversations`, TTS `bulbul:v3`, speaker "simran"), Gemini (`gemini-2.5-flash`, typed Ask agent, explanation only -- never prediction), Nominatim (geocoding), OSRM (feeder road-routing), optional Twilio (WhatsApp sandbox transport).

## 4. Lane Tasks

### Lane A -- Data & Engines (pure, synchronous, no FastAPI imports; every engine has a test module)
- **A1** Repo/backend bootstrap: directory skeleton, `requirements.txt`/`pyproject.toml`, Dockerfile (multi-stage, libgomp1), `.env.example`, `core/config.py` (Settings via pydantic-settings), `core/exceptions.py` (`LifelineGridError`/`NotFoundError`/`InvalidTransitionError`/`ApiError`), `main.py` (FastAPI app factory, CORS, security headers middleware, exception handlers, `# ROUTERS` marker), health endpoint.
- **A2** `constants.py` + `models.py`: every simulation/policy constant (see S6) and Pydantic domain models. Imported by nearly every later task; names must be spelled identically everywhere.
- **A3** `network.py` + seed generator: Voronoi DT service areas (`bounded_voronoi`), `ConsumerArrays`, `NetworkRepository` (lru-cached loader of `seed_network.json`), `synthetic_network()` for tests. Geocodes real localities (Nominatim) with coordinate fallback.
- **A4** `weather.py`: `WeatherSeries`, `synthetic_series`, `Scenario` model, `WeatherProvider` (actual vs. forecast-with-error), `BUILTIN_SCENARIOS`. Fetches real Open-Meteo archive data for 3 scenario files + 4 named scenarios (heatwave_evening, monsoon_cloud, solar_noon, re_2047).
- **A5** `loadgen.py`/`sizing.py`: `LoadModel` (bottom-up per-consumer demand from archetype shapes, IST-aligned 96-slot arrays), `AssetProfiles` (DT/hub/shift/facility/PV loads), calibration against CEEW smart-meter dataset, network sizing to target overload range.
- **A6** `thermal.py`: IEEE C57.91 Clause 7 transformer thermal equations (top-oil rise, hot-spot temp, ageing factor, dynamic thermal rating). Verified reference points: k=1,30C->110.0C hot-spot, ageing=1.0; k=1.2,42C->146.1C, ageing~29.
- **A7** `powerflow.py`: backward/forward sweep LV power-flow solver on radial tree (balanced 3-phase equivalent), verified against closed-form two-bus case.
- **A8** `supply.py`: `supply_fraction = min(1, firm + re_share*(0.6*solar_cf+0.4*wind_cf)/0.45 + grid_storage*evening)`; firm share calibrated per sub-division kind so shadow baseline matches CEEW outage hours.
- **A9** `daydata.py`/`forecaster.py` + training script: `DayBuilder` (demand/weather per IST day), LightGBM quantile models (P10/P50/P90) per DT in per-unit-of-rating, 13 features, split-conformal calibration to 80% coverage. Falls back to `seasonal_naive` mode if model files absent.
- **A10** `deficits.py`/`levers.py`: window detection (`find_windows`, merge/split rules), DT thermal limits by temperature, lever potential calculators (cap reduction, DR expected kW, shift reduction, hub/storage recoverable energy).
- **A11** `optimizer.py`: MILP Flex Plan optimiser (HiGHS) with greedy fallback. Variables: binary cap level per DT, charger curtailment fraction, storage discharge, shift on/off, unserved/overload slack. Minimises weighted relief cost + penalties for unserved/overload, constrained by gap coverage, DT limits, hub/storage energy budgets.
- **A12** `baseline.py`/`metrics.py`/`fairness.py`/`risk.py`/`dr_model.py`: rotational-shedding rotation logic, reliability metrics (HOH, SAIDI, SAIFI, lifeline availability), fairness (Jain index, Gini, Lorenz curve, served fraction by income band), DT risk scoring, Beta-Bernoulli DR acceptance learning model.

### Lane B -- World, Plans, Dispatch, Adapters, API, Voice
- **B1** `world.py`: `GridWorld` -- two parallel tracks (solution vs. shadow baseline) each interval: consumer-side DR/caps -> asset scheduling -> DT loads -> feeder shedding if needed -> recompute -> DT trip logic -> thermal/power-flow -> rebound energy -> critical-facility backup -> meter states/metrics/events.
- **B2** `planner.py`: `ForecastBundle` builder + `FlexPlanService` (plan state machine: refresh/approve/reject/cancel/simulate/sensitivity).
- **B3** Protocol adapters + ledger: `ledger.py` (`ProtocolLedger`, 7 protocols all tagged WIRED), `hes.py` (DLMS/COSEM limiter payloads, `MockHes`), `ocpp.py` (OCPP 1.6J `SetChargingProfile`), `openadr.py` (OpenADR 3 REST resources), `beckn.py` (Beckn/UEI trade confirms), `channels.py` (WhatsApp/IVR/SMS templates, bilingual hi/en, mock+optional Twilio transport).
- **B4** `dispatch.py`: `Dispatcher` -- fires the per-plan timeline (notify@T-120min -> signal@T-30min -> hes@T-15min -> start -> end -> verify@+15min) via the adapters.
- **B5** `service.py`/`store.py`/`stream.py`: `GridService` (boot/tick/kpis/reset/jump/autopilot), SSE stream (`tick`, `event`, `plan`, `plans`, `risk`, `kpis` event types), `deps.py`, admin endpoints.
- **B6** Auth: JWT (`PyJWT`), 6 roles (consumer/field/je/ae/regulator/admin), demo-login by role+subdivision, `require_roles`/`ensure_scope`. Reads public; mutations require role; every mutation writes an audit row.
- **B7** Safety invariants test file (`test_invariants.py`, 6 tests, never skipped/relaxed): T0/life-support never capped/DR'd; no cap below 300W floor; every cap command has expiry; 30-min minimum notice; no autonomous action without a named human approver; engines never import an LLM SDK.
- **B8** `views.py`: pure read-model functions (JSON-ready, no numpy/datetime) -- wire contract mirrored exactly by frontend TypeScript types.
- **B9** REST API: full `/api/v1` surface (subdivisions, feeders, transformers, critical, geo, insights, forecast, plans, flex, consumers, field, protocols, federation, scenario, economics, openadr, admin).
- **B10** Scenario Lab + calibration + economics: `run_scenario()`, baseline firm-share calibration to CEEW values, `unit_economics`/`national_impact` functions.
- **B11** Tool layer + typed agents: `resolve.py` (fuzzy name->id resolution), `grid_tools.py`/`schemas.py` (15 read-only tools, `build_tool_functions`, `TOOL_SCHEMAS`), `consumer_tools.py` (4 consumer-scoped tools), Gemini-backed typed Ask agent + Sarvam-backed voice agent, `briefing_service.py`.
- **B12** Voice pipeline: STT/chat-with-tools/TTS, WebSocket `/ws/voice`, `voice_prompt.py` for "Urja" persona, voice eval harness (40 cases, latency probe).
- **B13** Feeder paths (OSRM-routed polylines), fixtures export script (freezes app state at 20:30 IST, exports every GET endpoint to `frontend/src/data/fixtures/*.json`), endpoint sweep (p95 latency), deploy/secrets scripts, `start-demo.ps1`.

### Lane C -- Frontend Foundation
- **C1** Scaffold frontend from reference repo (generic shell/design-system/charts/map-base/voice-client copied verbatim; won't compile until C2-C4 land).
- **C2** Brand/tokens/domain/scope/roles/auth/nav: `brand.ts`, `domain.ts` (RiskLevel/PlanStatus/MeterState/LeverKey/CapLevel types + color/label maps), `scope.tsx` (`SUBDIVISION_IDS`, `ScopeProvider`/`useScope`), `roleContext.tsx`, `auth.ts`, CSS tokens (brand green `#b7e34a`, status/meter/lever colors).
- **C3** Typed data layer: `types.ts`, `hooks.ts` (`ApiResult<T>` + offline-fixture fallback), `mutations.ts`, `entities.tsx`.
- **C4** Live layer: `telemetry-store.ts` (non-React subscribe/publish store), `types.ts` (`DtTelemetry`, `Telemetry`, `LiveEvent`), `LiveProvider.tsx` (`useTelemetryStore`/`useTelemetry`/`useLiveState`/`useLiveEvents`).
- **C5** Design-system additions: `chips.tsx`, `StatusTag.tsx` (LIVE/WIRED/PILOT), `Delta.tsx`, `CompareStat.tsx`, heat scales.
- **C6** Chart components: FanChart, SupplyDemandChart, LeverWaterfall, LorenzCurve, GaugeArc, HourHeatmap, CompareBars, ThermalTrace, StepLine.
- **C7** Map layers: `ServiceAreaLayer`/`FeederLayer`/`DtLayer`/`AssetLayer`/`MapLegend`/`lens.ts`.
- **C8** Grid components: MeterWall, SingleLineDiagram, LeverStack, PlanCard, OptionsTable, DispatchStepper, DecisionBar, WhatIfPanel, SensitivityMatrix, EventTimeline, ProtocolMessage, SituationBanner.
- **C9** Voice UI port: FactCard switch over 12 grid card types.

## 5. Key Data Models / Entity Names

| Name | Represents |
|---|---|
| `GridService` | Top-level orchestrator: boot, tick, kpis, sim-clock control, audit/event logs |
| `GridWorld` | Runs the two parallel simulation tracks (solution + shadow baseline) |
| `Track` | Per-world state: metrics, burden/entitled kWh, SoC, hotspot, loss-of-life, trip timers |
| `Actions` | Per-interval control vector: cap_kw, cap_started, dr_on, hub_frac, storage_kw, shift_on |
| `IntervalResult` | One track's output for one interval |
| `LogRow` | Per-interval history row used for charts |
| `FlexPlanService` | Plan state machine |
| `ForecastBundle` | Gross/net/available-kW arrays + gap_kw per sub-division for 36h horizon |
| `PlanInputs` | MILP optimiser input bundle |
| `PlanSolution` | MILP/greedy output |
| `PlanOverrides` | What-if overrides |
| `FlexPlan` | Persisted/wire-level plan object |
| `views.*` | Pure read-model functions -- the API/tools/fixtures wire contract |
| `build_tool_functions` / `TOOL_SCHEMAS` | 15 read-only LLM tool callables + schemas |
| `useTelemetryStore` / `TelemetryStore` | Non-React store feeding map layers on every tick |
| `ServiceAreaLayer` | Leaflet layer painting Voronoi DT polygons |
| `SOURCE_SIM` / `SOURCE_FORECAST` | Card footer source-citation constants |
| `LEVER_ORDER` | Canonical lever sequence |
| `SUBDIVISION_IDS` | The 5 canonical sub-division ids |

## 6. Key Numeric Parameters (constants.py, Task A2)

- `INTERVAL_MIN=15`, `SLOTS_PER_DAY=96`
- `LIFELINE_FLOOR_W=300`
- `NOTIFY_LEAD_MIN=120`
- `NOTICE_MIN_CAPS=30` (hard invariant)
- `APPROVAL_DEADLINE_MIN=15`
- `SIGNAL_LEAD_MIN=30`
- `HES_LEAD_MIN=15`
- `VERIFY_DELAY_MIN=15`
- `FORECAST_HORIZON_SLOTS=144` (36h), `PLAN_HORIZON_SLOTS=96` (24h), `MAX_WINDOW_SLOTS=24` (6h), `ROSTER_MIN_SLOTS=4` (1h)
- `HOTSPOT_LIMIT_C=120`, `HOTSPOT_ALARM_C=110`, `TRIP_LOADING_PU=1.30` for `TRIP_INTERVALS=2` -> trips for `TRIP_OUTAGE_INTERVALS=8` (2h)
- `V_MIN_PU=0.94`, `V_MAX_PU=1.06`
- `CAP_COMPLIANCE=0.92`, `CAP_TRIP_SHARE=0.08`, `REBOUND_SHARE=0.30`, `REBOUND_RELEASE=0.15`, `SHED_TOLERANCE_FRAC=0.03`
- `DR_REBATE_RS_PER_KWH=2.0`, `HES_ACK_PROB=0.97`, `P2P_CHARGE_RS_PER_KWH=0.42`
- Dispatcher timeline: notify(120) -> signal(30) -> hes(15) -> start -> end -> verify(+15)

## 7. Build/Schedule (21 days, reference only -- this session compresses it)

Days 1-2 A1-A5/C1-C2; 3-4 A6-A12/C3-C4; 5-6 B1-B2/C5-C6; 7 B3-B4 (Checkpoint 1: plan runs end-to-end in tests)/C7; 8-9 B5-B7/C8-C9+D1; 10-11 B8-B10/D2-D8; 12 B11+B13/D9-D12; 13-14 B12 (Checkpoint 2: 3-min demo works locally)/D13-D20; 15-16 hardening/D21-D28/E3; 17 retrain+recalibrate/E4+E6; 18 Playwright+screenshots/E5; 19 polish/E7; 20 E8; 21 buffer/E9.

**Never simplify** (core, non-negotiable): D1, D3, D4, D8, D11, D15, D17, D22. **First to cut**: D12-D14, D23-D26.

## 8. UI/UX Page List (Lane D, 28 pages)

Shared recipe: route `page.tsx` (renders one view component) + view component (useScope + hooks, 12-col grid, PanelSkeleton while loading) + `titles.ts` + tests + screenshots. Acceptance: >=8 data cards, >=3 chart types, >=1 heatmap/matrix, one "moneyshot" number, unique silhouette, offline-fixture rendering, scope-reactive.

- **D1** `/command` -- Grid Command Centre
- **D2** `/voice` -- Voice Control Room
- **D3** `/plans` -- Flex Plans decision desk
- **D4** `/plans/[planId]` -- Flex Plan case file
- **D5** `/subdivisions` -- Sub-division Lab
- **D6** `/subdivisions/[id]` -- deep dive + printable scorecard
- **D7** `/transformers` -- directory w/ lens switch
- **D8** `/transformers/[dtId]` -- transformer case file
- **D9** `/map` -- Grid Map GIS console
- **D10** `/feeders` -- feeder board
- **D11** `/flex` -- Live Grid Ops
- **D12** `/flex/chargers` -- Managed Charging
- **D13** `/flex/storage` -- Storage and P2P
- **D14** `/flex/dr` -- Demand Response
- **D15** `/flex/lifeline` -- Lifeline and Fairness
- **D16** `/forecast` -- Forecast Studio
- **D17** `/reliability` -- Reliability
- **D18** `/thermal` -- Transformer Health
- **D19** `/power-quality` -- Voltage and Losses
- **D20** `/critical` -- Critical Loads registry
- **D21** `/consumers` -- Consumers and Channels
- **D22** `/scenario` -- Scenario Lab
- **D23** `/analytics` -- Analytics/governance
- **D24** `/economics` -- Economics
- **D25** `/protocols` -- Integrations
- **D26** `/regulator` -- Regulator View
- **D27** `/consumer` -- Consumer phone app
- **D28** `/field` -- Field worker app

## 9. Deployment / Demo Constraints

Software-only -- no new hardware; built on existing RDSS smart-meter/HES rails. Backend on Google Cloud Run (Docker, port 8080, free tier 1 GiB; world restarts on cold start -- documented limitation). Frontend on Vercel. All protocol integrations simulated against in-process adapters (tagged WIRED). Must work offline: every page renders from committed JSON fixtures when backend unreachable, with offline banner.

## 10. WhatsApp/IVR/TTS and Authentication

- **B3**: `channels.py` -- `ChannelGateway`, `TEMPLATES` (bilingual hi/en), `CHANNEL_NAMES=("whatsapp","ivr","sms")`, mock transport by default, optional Twilio sandbox. `broadcast()`/`send_one()`/`reply()`, logged to protocol ledger (WIRED).
- **B6**: JWT (`PyJWT`+`bcrypt`), 6 roles, `DEMO_USERS`/`DEMO_PASSWORD="lifeline-demo"`, `/api/v1/auth/{login,demo-login,me,demo-users}`. Admin/sim endpoints gated by `LIFELINE_ADMIN_ENABLED`.
- **B12**: STT `saaras:v3-realtime`, chat-with-tools, TTS `bulbul:v3` via WebSocket `/ws/voice`. `voice_prompt.py` "Urja" persona: grounds every fact in a tool call, never fabricates, responds in user's language, read-only (cannot approve/reject/send commands), directs actions to JE/AE. TTS also powers IVR audio via `GET /api/v1/consumers/messages/{id}/audio`.

## Cross-cutting rules (binding on every task)

Engines decide, models only phrase (no LLM output is ever a number/decision/command); 5 hard safety invariants each with a dedicated always-run test (B7); full determinism via seeded `numpy.random.default_rng`; every capability tagged LIVE/WIRED/PILOT; strict TDD; no placeholders/TODOs; frontend page rules (action-title functions, unique silhouettes, offline-fixture parity). Verification targets: backend >=220 pytest + ruff clean; frontend >=250 vitest + typecheck/lint/build clean; 8 Playwright e2e specs; calibration acceptance thresholds in tests.
