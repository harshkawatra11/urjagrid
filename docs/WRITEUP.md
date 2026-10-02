# LifelineGrid — Solution Write-Up

Schneider Electric Yuva Yodha Energy Tech Hackathon — Problem Statement 3: Grid Reliability

---

## 1. The problem

### 1.1 The control point already exists, and almost nobody uses it

India has installed roughly **5.28 crore smart meters**, of which **3.90 crore are under RDSS** (the Revamped Distribution Sector Scheme, the Ministry of Power's flagship metering programme), as of 31 December 2025 — and that number is growing every month (PIB: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2222217&reg=3&lang=2). RDSS prepaid smart meters already support a **remote, DLMS/COSEM load-limit command** issued from the head-end system (HES) — the same mechanism a DISCOM uses today to cap a defaulting customer's load can just as easily set a *protective, time-boxed, fair* lifeline cap during a real shortfall (Prayas Energy: https://energy.prayaspune.org/power-perspectives/smart-metering-in-india-a-work-in-progress).

That capability sits almost entirely unused for reliability purposes. DISCOMs still default to **rotational feeder shedding** — cutting an entire feeder's worth of households for a fixed block, with no regard for who actually needs the power least, or most.

### 1.2 The gap is real and measurable, not hypothetical

- Average hours of power supply, FY25: **22.6 hours/day rural, 23.4 hours/day urban** (PIB: https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2105394). Even the national aggregate shows a persistent several-hour gap, worse in rural areas.
- **About 13 lakh distribution transformers fail every year — roughly 10% of the installed base** — overwhelmingly from sustained thermal overload during peak-demand hours (Mercom India: https://www.mercomindia.com/cea-steps-in-as-distribution-transformer-failures-hit-1-3-million-a-year). Every one of those failures is an unplanned, unfair, often multi-day outage for everyone downstream of that DT — the opposite of what a managed, forecast-driven response would produce.
- CEEW's smart-meter dataset for **Mathura and Bareilly** — the exact two towns this prototype's simulated network is modelled on — documents the real-world outage and reliability patterns a software layer like this would be measured against (CEEW: https://www.ceew.in/publications/what-smart-meters-can-tell-us; Harvard Dataverse: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/GOCHJH).
- Uttar Pradesh's smart meters moved to **postpaid billing on 6 May 2026** (The Tribune: https://www.tribuneindia.com/news/business/your-uppcl-smart-meter-is-now-postpaid-what-changed-and-what-did-not/amp) — i.e. the metering and billing rails this solution depends on are not a future hypothetical in UP, they are live infrastructure today.

### 1.3 Smart-meter underutilisation and rotational shedding's unfairness

Two failures compound each other. First, **underutilisation**: a remotely-settable load limit is a reliability tool sitting idle on every RDSS meter — DISCOMs use it for billing enforcement, essentially never for graceful degradation. Second, **unfairness**: rotational shedding treats a household running a single fan identically to a shop mid-transaction or a home with a sleeping infant and no fallback — because the feeder, not the meter, is the unit of control. A meter-level, tier-aware, human-approved cap is strictly fairer than a feeder-level blackout, and it is achievable with infrastructure that is already metering 39 million+ connections.

## 2. The solution

### 2.1 The closed loop

LifelineGrid runs a seven-step loop, with a human in the loop at step 4 — never automated past it:

**Sense → Forecast → Propose → Approve (human, JE/AE) → Dispatch → Confirm → Learn**

- **Sense**: data adapters pull meter reads, weather, and feeder/DT state.
- **Forecast**: engines (trained quantile forecaster, thermal model, LV power-flow solver) project demand and available supply 36 hours out, per DT.
- **Propose**: when a shortfall or thermal overload is detected, a MILP optimiser (HiGHS, with a greedy fallback) builds a Flex Plan — which levers, which DTs, at what level, for how long — minimising relief cost plus penalties for any unserved energy or overload left on the table.
- **Approve**: a named Junior Engineer (or, cross-sub-division, an Assistant Engineer) reviews, edits, or rejects the plan. **No plan dispatches without this signature.**
- **Dispatch**: the approved plan fires on a fixed timeline — notify (T-120 min) → signal (T-30 min) → HES command (T-15 min) → start → end → verify (T+15 min) — through the relevant adapter (HES, OCPP, OpenADR, channels).
- **Confirm**: interval meter reads verify the relief that actually happened (measurement & verification), not just the relief that was planned.
- **Learn**: a Beta-Bernoulli acceptance model updates per-consumer DR-response priors, and a fairness ledger rotates which consumers/DTs carry the burden next time, so the same households aren't always first to be capped.

### 2.2 The lever order — always tried in this sequence

| # | Lever | Mechanism | Why it's here in the order |
|---|---|---|---|
| L1 | Behavioural DR | WhatsApp/IVR ask + **Rs 2/kWh** bill rebate | Voluntary, reversible, cheapest, no hardware command sent at all |
| L2 | Managed charging | OCPP 1.6J `SetChargingProfile` to e-rickshaw/EV hubs | Shifts a load that was never essential to that exact 15-minute slot |
| L3 | Shiftable public loads | OpenADR 3 signal to water pumps / telecom towers | Public infrastructure with slack, not a household |
| L4 | Existing storage discharge | Draws down batteries already deployed on the network | Uses capacity that's sitting there, no new hardware |
| L5 | Lifeline caps | DLMS/COSEM remote load-limit via HES, per meter, **with an expiry** | Touches a household directly — only after four softer levers have been tried, and never below a protected floor |
| L6 | Rotational shedding | Status quo fallback | Last resort only — the plan degrades to today's practice, never worse than it |

This order is a hard design constraint, not a tunable default: cheaper, less-invasive, more-reversible levers are always exhausted before a lifeline cap is even considered, and a full blackout (L6) is never the first move the system reaches for.

### 2.3 Tiers and cap levels

- **T0** — critical facilities and registered life-support homes: **never** capped, asked, or shed, under any plan, by a hard-coded invariant.
- **T1** — households: guaranteed lifeline floor **≥300 W**.
- **T2** — livelihood/shops: guaranteed lifeline floor **≥500 W**.
- **T3** — flexible assets (chargers, pumps, shiftable public loads): shifted first, before any household tier is touched.

Cap levels step down gradually rather than jumping to the floor: **0 None → 1 Comfort (1000 W/2000 W) → 2 Essential (500 W/1000 W) → 3 Lifeline (300 W/500 W for T1/T2)** — so a household first loses comfort load, not survival load.

### 2.4 Why a human engineer approves every plan — non-negotiable

This is the single design decision the rest of the product protects:

1. **Safety.** The optimiser is making a recommendation about real households' electricity, including ones with medical equipment that the registry may not yet have flagged. A human with local knowledge of the sub-division is the last line of defence against a model's blind spot.
2. **Accountability.** Every mutation in the system writes an audit row tied to a named person's login. If a lifeline cap goes out, there must be a specific engineer who signed off on it — not an algorithm with no one to answer to.
3. **Legal and regulatory reality.** Load-limiting a customer's connection is already a regulated DISCOM action; it is performed under human authority today for billing enforcement, and this product does not get to lower that bar for a reliability use case. India's electricity regulatory framework assumes a utility officer is responsible for supply decisions — LifelineGrid is built to fit inside that framework, not route around it.
4. **It is cheap to keep.** The approval step costs an engineer perhaps a few minutes per plan on a dashboard built for exactly this (`/plans`, `/plans/[planId]`) — a trivial cost against the first two reasons.

The backend encodes this as one of six hard, always-run safety invariants (`backend/tests/test_invariants.py`), including: T0/life-support consumers are never capped or DR'd; no cap ever goes below the 300 W floor; every cap command carries an expiry; every cap/shed command gives at least 30 minutes' notice; **no autonomous action ever dispatches without a named human approver**; and the simulation/forecast/optimisation engines never import an LLM SDK at all — so there is no path by which a language model could ever produce a number, a decision, or a dispatched command. Gemini and the voice pipeline exist only to *phrase* what the engines already decided.

## 3. Why this is suited to Indian conditions

- **Works on existing RDSS rails — no new hardware.** The single most important design constraint. The control point (remote load-limit) is already on the wall for 3.90 crore meters under RDSS; LifelineGrid is the missing orchestration layer, not a new box to bolt onto a pole.
- **Built for the UP DISCOM context specifically.** The simulated network models two real UP DISCOMs (MVVNL, DVVNL) across two real towns (Bareilly, Mathura) — the same two towns CEEW's own smart-meter study covers — with five real sub-divisions, 12 feeders, 48 distribution transformers, and roughly 7,000 consumers. The scenarios (heatwave evening peak, monsoon cloud cover, clear solar noon, a 2047 high-renewable day) are built from this geography's actual weather patterns via the Open-Meteo historical archive, not generic placeholders.
- **Vernacular, voice-first channels for low-literacy and low-connectivity users.** Consumer notices go out as Hindi-first WhatsApp/IVR/SMS templates with a two-hour lead time, and the voice persona "Urja" answers questions by phone in the user's own language — because a dashboard is useless to the household it's trying to protect.
- **A fairness ledger that rotates the burden**, because the realistic Indian grid-reliability failure mode isn't just "not enough power" — it's the same low-income households absorbing every shortfall, every time, because they have the least leverage to complain.
- **Designed for exactly the regulatory posture India already has**: a human officer (JE/AE) retains statutory-style authority over supply decisions, a Regulator role sees aggregates only (never consumer-level data, which never leaves the DISCOM node), and every protocol integration is built against the India Energy Stack's own direction of travel (Ministry of Power task force: https://indianinfrastructure.com/2025/07/01/ministry-of-power-launches-task-force-to-develop-india-energy-stack/; https://solarquarter.com/2025/11/26/ministry-of-power-advances-india-energy-stack-with-rec-led-taskforce-meeting/).
- **Compatible with the P2P and storage pilots India is already running** — the Rs 0.42/kWh peer-to-peer trading charge modelled in the economics engine mirrors the DERC/UPERC pilots already approved (Mercom India: https://www.mercomindia.com/delhi-launches-six-month-pilot-on-peer-to-peer-solar-trading; SolarQuarter: https://solarquarter.com/2026/02/23/uperc-approves-interstate-p2p-renewable-energy-trading-pilot-with-delhi-discoms/), and the storage-discharge lever (L4) is scaled to be plausible against real distribution-level batteries like BRPL's Kilokari 20 MW/40 MWh project (pv magazine India: https://www.pv-magazine-india.com/2024/05/08/indias-first-utility-scale-standalone-battery-energy-storage-project-receives-regulatory-approval/) and the rooftop solar now on over five million households under PM Surya Ghar (pv magazine India: https://www.pv-magazine-india.com/2026/08/04/pm-surya-ghar-rooftop-solar-scheme-surpasses-5-million-households/).

## 4. Key assumptions — stated honestly

This section exists because the hackathon brief requires it, and because a prototype that hides its assumptions is less trustworthy than one that lists them.

**Where real data was used:**
- Weather for all four built-in scenarios is fetched from the real Open-Meteo historical archive for Bareilly/Mathura, not synthetic noise (`backend/app/grid/weather.py`).
- The transformer thermal model implements the actual IEEE C57.91 Clause 7 equations, verified against two textbook reference points: k=1.0, ambient 30°C → hot-spot 110.0°C, ageing factor 1.0; k=1.2, ambient 42°C → hot-spot 146.1°C, ageing factor ≈29 (`backend/app/grid/thermal.py`).
- The quantile demand forecaster (P10/P50/P90) is a genuinely trained LightGBM model with split-conformal calibration, not a hand-tuned curve, with a documented `seasonal_naive` fallback mode if model files are absent.
- The real, committed seed network (`backend/data/network/seed_network.json`) has 48 DTs and ~7,000 consumers across 5 sub-divisions, geocoded to real Bareilly/Mathura localities via Nominatim.

**Where the prototype simulates, and says so:**
- No real DISCOM's live HES/MDM, SCADA, or billing system is connected — every protocol adapter (HES/DLMS, OCPP, OpenADR, Beckn/UEI, WhatsApp/IVR/SMS) runs against an in-process mock that logs to a protocol ledger and is explicitly tagged **WIRED**, not LIVE.
- The firm-supply-share calibration (`FIRM_SHARE_BY_KIND`: urban 0.88 / semi-urban 0.78 / rural 0.68) is a **rank-ordered, plausible-magnitude** prototype calibration against the broad pattern in CEEW's surveys (rural sub-divisions see materially more outage hours than urban ones) — the raw CEEW microdata was not available in this build environment, so this is a rank-order match, not a statistical fit to a specific CEEW figure. This is stated directly in the code (`backend/app/services/scenario.py` module docstring) and the acceptance test only checks rank order, not a specific value.
- The unit-economics model (`backend/app/services/economics.py`) is, in its own words, "a small, transparent spreadsheet-style model (not a fitted financial model)" — every input (software fee Rs 8/meter/month, avoided-shedding value Rs 9.5/kWh, DR rebate Rs 2/kWh, national meter-count extrapolation base of 30 crore) is a named, documented assumption, not a fitted number. See `docs/IMPACT.md` for exactly how these were exercised and what came out.
- National-scale figures anywhere in this build are **linear extrapolations from a pilot's per-month figures**, explicitly labelled as extrapolations, not forecasts.
- The simulation world restarts from scenario start on a Cloud Run cold start (state isn't yet durably persisted across restarts) — a documented limitation, not a hidden one.
- Household registration of life-support/critical status (T0) depends on a field worker actually completing that registration; the prototype cannot know about a medical device it was never told about. This is exactly why the human-approval step in Section 2.4 exists — it is the designed backstop for precisely this gap.

## 5. What "done" means here

335 backend pytest tests pass, 28 frontend dashboard/standalone pages render (29 `page.tsx` files including the root redirect), and every capability on every screen is tagged LIVE, WIRED, or PILOT using the matrix in this document and in `README.md`. Where this write-up cites a number, it is either a published external source (linked above) or a number this team actually produced by running the code — see `docs/IMPACT.md` for exactly which commands were run and what they returned.
