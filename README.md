# UrjaGrid

**Brownout, never blackout.**

A software-only decision layer for Indian power distribution companies (DISCOMs) that turns an impending outage into a managed, fair, human-approved Flex Plan — built entirely on smart-metering infrastructure that already exists on the wall.

Submitted to **Schneider Electric's Yuva Yodha Energy Tech Hackathon — Problem Statement 3: Grid Reliability.**

---

## 1. The problem

India's distribution network loses reliability in a very specific, very fixable way:

- About **5.28 crore smart meters** are installed nationally, **3.90 crore of them under RDSS** (the government's own distribution-reform scheme), as of 31 Dec 2025 — and RDSS meters already support a **remote load-limit command**. That control point exists today; almost nothing uses it. ([PIB](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2222217&reg=3&lang=2), [Prayas](https://energy.prayaspune.org/power-perspectives/smart-metering-in-india-a-work-in-progress))
- Average hours of power supply in FY25 were **22.6 h/day rural, 23.4 h/day urban** — meaning real, measurable gaps remain even in the aggregate national figures. ([PIB](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2105394))
- About **13 lakh distribution transformers fail every year (~10% of the installed base)** — mostly from sustained thermal overload that a smarter dispatch could have avoided. ([Mercom India](https://www.mercomindia.com/cea-steps-in-as-distribution-transformer-failures-hit-1-3-million-a-year))
- When a shortfall does hit, the default DISCOM response is **rotational feeder shedding**: every household on a feeder loses power for the same block, regardless of whether they have a working fridge of insulin, a shop that just opened, or nothing to lose at all. It is blunt and it is the opposite of fair.

UrjaGrid's bet: the hardware for something better is already installed. What's missing is the software that forecasts the gap, tries every softer lever first, and puts a named engineer in the approval seat before anything touches a household's supply.

## 2. How it works — the seven-step loop

```
Sense → Forecast → Propose → Approve (human) → Dispatch → Confirm → Learn
```

Every hour, UrjaGrid forecasts demand and available supply for the next 36 hours, per distribution transformer (DT). When a shortfall or thermal overload is detected, it builds a **Flex Plan** that tries levers in a strict, always-the-same order — softest first:

| Lever | What it does |
|---|---|
| **L1** Behavioural DR | WhatsApp/IVR ask + Rs 2/kWh bill rebate to shift load voluntarily |
| **L2** Managed charging | OCPP `SetChargingProfile` slows e-rickshaw/EV charging hubs |
| **L3** Shiftable public loads | OpenADR signal to water pumps / telecom towers |
| **L4** Existing storage discharge | Draws down batteries already in the network |
| **L5** Lifeline caps | DLMS remote load-limit via HES — per household, with an expiry, never below a guaranteed floor |
| **L6** Rotational shedding | Status quo fallback — only when L1–L5 can't close the gap |

A named **Junior Engineer (JE)** must approve, edit, or reject every plan before anything dispatches — this is non-negotiable (see `docs/WRITEUP.md`). Approved plans go out as **Hindi notices two hours ahead**, then time-boxed commands to meters/chargers. Afterwards, meter readings verify the relief actually happened, DR rebates settle, and a fairness ledger rotates who carries the burden next time.

Three tiers protect the vulnerable automatically: **T0** (hospitals, life-support homes) is never capped, asked, or shed; **T1** households keep a guaranteed **≥300 W** lifeline; **T2** shops keep **≥500 W**; **T3** flexible assets (chargers, pumps) are shifted first.

## 3. What's actually real — honest status matrix

UrjaGrid tags every capability on screen, using these exact labels:

| Tag | Meaning | Examples in this build |
|---|---|---|
| **LIVE** | Real algorithm/external service runs in the prototype | Weather ingestion, load-shape model, net-load forecaster (trained LightGBM), thermal model (IEEE C57.91), LV power flow, MILP optimiser, shadow baseline, voice (Sarvam STT/TTS), typed-ask agent (Gemini), auth |
| **WIRED** | Spec-shaped code path against an in-process simulator — not real hardware | OCPP charger gateway, OpenADR VTN, DLMS/HES load-limit gateway, Beckn/UEI, WhatsApp/IVR/SMS channels, federation |
| **PILOT** | Not built in this prototype | Real HES/MDM integration, India Energy Stack consent flows, production messaging contracts |

This matrix is reproduced verbatim as `<StatusTag>` chips on every dashboard page. Nothing in this repo claims to be more finished than it is.

## 4. Running it locally

### Backend (FastAPI, Python 3.12)

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest -q      # 335 tests, should all pass
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

### Frontend (Next.js 16, TypeScript)

```powershell
cd frontend
npm install
npm run dev     # http://localhost:3000
```

### One-shot demo script

From the repo root:

```powershell
.\start-demo.ps1
```

This verifies `backend/.venv` exists, runs the backend's pytest suite as a smoke check, then starts uvicorn on `127.0.0.1:8080` (the same port the Cloud Run container uses). Pass `-SkipTests` to skip the smoke check, `-Port <n>` to use a different port.

## 5. Screenshots

No real screenshots are included in this repository — a hosted browser session was not available while building these deliverables, so nothing is faked here. For a live demo recording, capture:

- `/command` — Grid Command Centre (the single-screen overview)
- `/plans/[planId]` — a Flex Plan case file mid-approval, showing the JE's decision bar
- `/map` — the Leaflet GIS console with DT service-area (Voronoi) polygons and live tick-driven colour
- `/flex` — Live Grid Ops, levers firing in the correct L1→L6 order
- `/voice` — the Voice Control Room with the Urja orb answering a typed/spoken question
- `/reliability` and `/economics` — the solution-vs-shadow-baseline comparison charts that back `docs/IMPACT.md`

## 6. Tech stack

**Backend:** Python 3.12, FastAPI, Pydantic v2, uvicorn, `google-genai` (Gemini typed Ask agent), LightGBM (quantile forecaster), HiGHS-backed MILP optimiser (via scipy, with a greedy fallback), PyJWT + bcrypt auth, pytest/ruff.
**Frontend:** Next.js 16 (App Router), TypeScript (strict, no `any`), Vitest + Playwright, Leaflet/react-leaflet, Recharts.
**External services:** Open-Meteo (weather), Sarvam AI (STT/TTS), Gemini (explanation only — never prediction or decision), Nominatim/OSRM (geocoding/routing).
**Deploy:** Backend → Google Cloud Run (`backend/Dockerfile`, port 8080, 1 GiB free tier). Frontend → Vercel. See `docs/DEPLOYMENT.md`.

## 7. Documents in this repo

| Doc | Covers |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Full condensed technical specification |
| [`docs/WRITEUP.md`](docs/WRITEUP.md) | Full solution write-up — problem, solution, why India, assumptions, why a human must approve |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram + data/energy/money flow diagrams (Mermaid) |
| [`docs/IMPACT.md`](docs/IMPACT.md) | Quantified benefit vs. baseline, measured by actually running the backend |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deployment architecture + six-week pilot / scale-up plan |
| [`docs/DESIGN_ARTIFACTS.md`](docs/DESIGN_ARTIFACTS.md) | Where the design artifacts actually live in this codebase |

Repo layout: `backend/app/{core,api/v1,grid,adapters,services,tools,agents,prompts,voice}`, `backend/data/{weather,scenarios,models,network}`, `backend/scripts/`, `backend/tests/`; `frontend/src/{app,components,lib,data/fixtures}`; `docs/`.
