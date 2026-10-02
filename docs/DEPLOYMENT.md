# LifelineGrid — Deployment & Scale-Up Plan

## 1. The hard constraint: software-only

LifelineGrid is built under a **software-only deployment constraint** (`docs/SPEC.md` section 9): no new hardware, no new box on a pole, no new meter. Every control action rides on rails that already exist — the RDSS smart-meter/HES load-limit command, existing OCPP charger hubs, existing OpenADR-capable public loads, existing storage. This is a deliberate choice, not a limitation to apologise for: it is what makes a six-week pilot plausible at all, and it is what a DISCOM's procurement process can actually approve without a capex cycle.

## 2. Target deployment architecture

- **Backend → Google Cloud Run.** `backend/Dockerfile` is a multi-stage build: a `builder` stage compiles dependencies (including `libgomp1`-linked LightGBM) with `build-essential`, and the `runtime` stage is a slim `python:3.12-slim` image with only `libgomp1` installed (required at runtime for LightGBM's OpenMP-linked native extension). It listens on port 8080, matching Cloud Run's expected container port, and runs `uvicorn app.main:app --host 0.0.0.0 --port 8080`.
- **Free-tier footprint.** Designed to run inside Cloud Run's 1 GiB free-tier instance. The whole simulation — 48 DTs, 7,000 consumers, every engine — runs as a single process with one `GridService` and one tick loop; there is no database, no message queue, no second service to operate.
- **Documented limitation.** The simulation world is persisted to `.runtime/grid_state.json` periodically (max every 5 real seconds when dirty) but **restarts from scenario start on a Cloud Run cold start** — stated plainly, not hidden. For a real pilot (Section 4), the persisted state target is the DISCOM's own HES/MDM, not this JSON file.
- **Frontend → Vercel.** Next.js 16 App Router, deployed the standard Vercel way. Every page is required to render from committed offline-fixture JSON when the backend is unreachable, with a visible offline banner — so a flaky demo network never produces a blank screen.
- **Secrets.** `backend/.env.example` documents the required environment variables (Gemini/Sarvam API keys, JWT signing secret, `LIFELINE_ADMIN_ENABLED` gate for sim-control endpoints); `backend/scripts/deploy_secrets_helper.py` exists to push these into the target platform's secret manager rather than committing them.

### Cloud Run deployment steps (from `backend/`)

```powershell
# 1. Build the image
docker build -t lifelinegrid-backend .

# 2. Push to Artifact Registry (or your registry of choice)
docker tag lifelinegrid-backend <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/lifelinegrid-backend
docker push <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/lifelinegrid-backend

# 3. Deploy
gcloud run deploy lifelinegrid-backend `
  --image <REGION>-docker.pkg.dev/<PROJECT>/<REPO>/lifelinegrid-backend `
  --platform managed `
  --region <REGION> `
  --port 8080 `
  --memory 1Gi `
  --allow-unauthenticated   # or set up IAM/JWT in front, per your DISCOM's security posture
```

### Vercel deployment steps (from `frontend/`)

```powershell
npm install
vercel link        # once
vercel env pull     # pull NEXT_PUBLIC_API_BASE_URL etc.
vercel --prod
```

Point `NEXT_PUBLIC_API_BASE_URL` at the deployed Cloud Run service URL.

## 3. What is WIRED today, and what a real pilot needs to turn LIVE

Per the honest status matrix (`README.md` section 3, `docs/SPEC.md` section 1):

| Capability | Today (this build) | For a real pilot |
|---|---|---|
| HES/DLMS load-limit | WIRED — `MockHes` in-process simulator | Real HES vendor API integration (the DISCOM's actual head-end system) |
| OCPP charger control | WIRED — `MockChargePoint` | Real OCPP 1.6J connection to the DISCOM's or a partner's charging hub |
| OpenADR public loads | WIRED — `OpenAdrVtn` mock | Real OpenADR 3 VEN endpoints on pump/tower controllers |
| WhatsApp/IVR/SMS | WIRED — mock transport, optional Twilio sandbox | Production messaging contract (WhatsApp Business API, a telecom-grade IVR line) |
| India Energy Stack consent | PILOT — not built | Integration once the Ministry of Power's task force publishes a stable consent API |

None of this requires new hardware to close — it requires commercial/API integration work with systems the DISCOM already operates.

## 4. Six-week pilot plan: shadow mode → live, wave rollout

This is the concrete path from "working prototype" to "a DISCOM trusts it with real meters," matching `docs/SPEC.md` section 9's deployment constraints:

**Weeks 1–2 — Shadow mode, read-only.**
Connect LifelineGrid's adapters to a single real sub-division's HES/MDM in **read-only** mode. The forecaster, thermal model, and optimiser run against real meter reads and produce real Flex Plans — but nothing dispatches. A JE reviews every shadow-mode plan against what actually happened on the feeder that day, purely to build trust and catch model blind spots before any command touches a real meter.

**Weeks 3–4 — Live, single sub-division, L1–L3 only.**
Turn on dispatch for the softest levers only: behavioural DR (WhatsApp/IVR ask + rebate), managed charging, and shiftable public loads. No lifeline caps yet. This is the lowest-risk way to validate the notify → signal → verify timeline end-to-end against a real channel provider and real meter interval reads, with a human JE approving every plan exactly as in the prototype.

**Week 5 — Live, single sub-division, full lever stack (L1–L5).**
Enable lifeline caps (L5) under the same human-approval gate, with the registered-critical-facility list (T0) double-checked by a field worker before go-live, since a wrong T0 omission is exactly the failure mode the approval step exists to catch.

**Week 6 — Wave rollout.**
Expand from one sub-division to the remaining four, one at a time, each gated on the previous wave's reliability and fairness metrics (SAIDI/SAIFI, Jain fairness index, lifeline-availability) matching or beating the shadow-mode baseline. Any sub-division that doesn't clear this bar stays in shadow mode until it does.

Throughout, the regulator-facing aggregate view (`/regulator`) is live from week 1, so the DISCOM's own regulatory reporting obligations are served even during shadow mode.

## 5. Cost and ownership model

From `docs/IMPACT.md` and `backend/app/services/economics.py`:

- **DISCOM pays** a monthly software fee (modelled at Rs 8/meter/month in the prototype's economics engine) and funds the DR rebate pool (Rs 2/kWh shifted).
- **Consumers pay nothing** for the service; DR participants are paid a rebate, not charged.
- **Field workers are paid per verified critical-facility/life-support registration** — a small, direct incentive to keep the T0 registry current, which is itself a reliability control, not just a cost line.
- **DISCOM's return** comes from energy that would otherwise have been shed (now served or fairly rationed), fewer DT failures, deferred capital upgrades, and improved regulatory reliability indices — see `docs/IMPACT.md` Section 5 for the actual modelled pilot-scale numbers (Rs 15–28 lakh/month net benefit on a 7,000-meter pilot, at illustrative 50–90% recovery rates) and why the naive national extrapolation of that figure is explicitly flagged as implausible rather than presented as a real projection.
- **Ownership**: the DISCOM owns the deployment, the data, and the approval authority at every step — LifelineGrid is infrastructure software sitting inside the DISCOM's own operational boundary, not a third party controlling consumer supply. This mirrors the India Energy Stack's own federated design intent (Ministry of Power task force, cited in `docs/WRITEUP.md`).
