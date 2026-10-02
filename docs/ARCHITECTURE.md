# UrjaGrid — System Architecture

Source of truth: `docs/SPEC.md` section 2 ("System Architecture"). This document renders that section as four Mermaid diagrams: one component diagram, and one each for the data, energy, and money flows.

---

## 1. Component diagram

```mermaid
flowchart TB
    subgraph People["People"]
        HH["Household / shop\n(consumer role)"]
        FW["Field worker / lineman\n(field role)"]
        JE["Junior Engineer\n(je role)"]
        AE["Assistant Engineer /\nDISCOM control room\n(ae role)"]
        REG["Regulator\n(regulator role)"]
    end

    subgraph Frontend["Frontend -- Next.js 16 on Vercel"]
        DASH["28 dashboard pages\n(/command, /plans, /map, /flex, ...)"]
        VOICE_UI["Voice Control Room + Urja orb\n(/voice)"]
        CONSUMER_APP["Consumer phone app\n(/consumer)"]
        FIELD_APP["Field worker app\n(/field)"]
    end

    subgraph Backend["Backend -- FastAPI on Google Cloud Run"]
        REST["REST /api/v1"]
        SSE["SSE /api/v1/stream"]
        WS["WS /ws/voice"]

        subgraph Engines["Engines"]
            LOAD["Load model"]
            FCAST["Quantile forecaster\n(LightGBM, LIVE)"]
            THERM["Thermal model\n(IEEE C57.91, LIVE)"]
            PF["LV power flow\n(LIVE)"]
            DEF["Deficit detector"]
            OPT["MILP optimiser\n(HiGHS, LIVE)"]
            SHADOW["Shadow baseline\n(LIVE)"]
            FAIR["Fairness ledger"]
            MV["Metrics / M&V"]
        end

        GRIDSVC["GridService\n(sim clock / tick / state store)"]
        PLANSVC["FlexPlanService\n(plan state machine)"]
        DISPATCH["Dispatcher"]
        TOOLS["15 read-only Tools\n(grid_tools.py)"]
    end

    subgraph Adapters["Adapters (all WIRED -- in-process simulators)"]
        HES["HES gateway\n(DLMS load limit)"]
        OCPP["OCPP 1.6J gateway"]
        OPENADR["OpenADR 3 VTN"]
        BECKN["Beckn / UEI"]
        CHAN["Channels\n(WhatsApp / IVR / SMS)"]
        LEDGER["Protocol ledger"]
    end

    subgraph External["External services"]
        METEO["Open-Meteo"]
        SARVAM["Sarvam AI\n(STT / TTS)"]
        GEMINI["Gemini\n(explanation only)"]
    end

    HH -->|WhatsApp / IVR / app| CONSUMER_APP
    FW --> FIELD_APP
    JE --> DASH
    AE --> DASH
    AE --> VOICE_UI
    REG --> DASH

    CONSUMER_APP --> REST
    FIELD_APP --> REST
    DASH --> REST
    DASH --> SSE
    VOICE_UI --> WS

    REST --> GRIDSVC
    REST --> PLANSVC
    SSE --> GRIDSVC
    WS --> TOOLS

    GRIDSVC --> Engines
    PLANSVC --> OPT
    PLANSVC --> DEF
    GRIDSVC --> SHADOW
    GRIDSVC --> MV
    MV --> FAIR

    PLANSVC -->|approved plan| DISPATCH
    DISPATCH --> HES
    DISPATCH --> OCPP
    DISPATCH --> OPENADR
    DISPATCH --> CHAN
    HES --> LEDGER
    OCPP --> LEDGER
    OPENADR --> LEDGER
    BECKN --> LEDGER
    CHAN --> LEDGER

    TOOLS --> GRIDSVC
    TOOLS --> PLANSVC

    FCAST -.trains against.-> METEO
    LOAD -.weather input.-> METEO
    WS --> SARVAM
    WS --> GEMINI

    CHAN -.notifies.-> HH
    HES -.load-limit command.-> HH
    OCPP -.SetChargingProfile.-> HH
```

## 2. Data flow

```mermaid
flowchart LR
    METER["Meters"] --> HES_MDM["HES / MDM"]
    HES_MDM --> ADAPT["Adapters\n(HES, OCPP, OpenADR, channels)"]
    ADAPT --> ENG["Engines\n(forecast, thermal, power flow, optimiser)"]
    ENG --> PLAN["Flex Plan\n(draft)"]
    PLAN --> APPROVAL["JE / AE approval\n(human, mandatory)"]
    APPROVAL -->|approved| DISP["Dispatcher"]
    APPROVAL -->|rejected / edited| ENG

    DISP --> HES2["HES"]
    DISP --> CHARGERS["Chargers (OCPP)"]
    DISP --> OPENADR2["OpenADR targets"]
    DISP --> CHANNELS["Channels (WhatsApp/IVR/SMS)"]

    HES2 --> READS["Interval meter reads"]
    CHARGERS --> READS
    OPENADR2 --> READS

    READS --> MVCHECK["M&V\n(measurement & verification)"]
    MVCHECK --> MODELS["Models\n(DR-acceptance learning, fairness ledger)"]
    MODELS -.feeds back into.-> ENG

    REGVIEW["Regulator view"] -.aggregates only.-> MVCHECK

    style REGVIEW fill:#eee,stroke:#999
```

Consumer-level data never leaves the DISCOM node. The Regulator role only ever sees aggregate reliability/flexibility/fairness figures — never a named household's data.

## 3. Energy flow

```mermaid
flowchart TB
    UPSTREAM["Upstream supply\n(firm + renewable)"] --> SUB["33/11 kV substation"]
    SUB --> FEEDER["11 kV feeder"]
    FEEDER --> DT["Distribution transformer (DT)"]
    DT --> LV["LV network"]
    LV --> HOMES["Homes"]
    LV --> SHOPS["Shops"]
    LV --> CHARGERS2["EV / e-rickshaw chargers"]
    LV --> PUMPS["Water pumps"]
    LV --> TOWERS["Telecom towers"]

    SOLAR["Rooftop solar"] -.injects at LV.-> LV
    STORAGE["Existing storage"] -.injects/discharges at LV.-> LV

    DT -. thermal limit .-> THERMCHECK{"Within DT\nthermal limit?"}
    THERMCHECK -->|no, in deficit| PLANACTION["Flex Plan reduces kW at:\nchargers, shiftable loads, capped meters"]
    PLANACTION --> LV
    THERMCHECK -->|yes| LV
```

In a deficit, the active Flex Plan reduces kW draw at chargers, shiftable public loads, and capped meters — in that lever order — until demand fits both the available upstream supply and each DT's own thermal limit.

## 4. Money flow

```mermaid
flowchart LR
    DISCOM["DISCOM"] -->|monthly software fee\nper meter| LIFELINEGRID["UrjaGrid"]
    DISCOM -->|Rs 2/kWh DR rebate| CONSUMERS["Consumers who shift load"]
    DISCOM -->|per verified registration| FIELDWORKERS["Field workers"]

    CONSUMERS -->|pays nothing for the service| LIFELINEGRID

    AVOIDED["Energy that would've\nbeen shed, now served"] -->|value recovered| DISCOM
    FEWERFAIL["Fewer DT failures"] -->|avoided replacement cost| DISCOM
    DEFERRED["Deferred network upgrades"] -->|avoided capex| DISCOM
    BETTERREL["Better reliability indices\n(SAIDI/SAIFI)"] -->|regulatory standing| DISCOM

    style CONSUMERS fill:#eee,stroke:#999
```

DISCOM pays a per-meter monthly software fee; consumers pay nothing for the service itself (DR participants are paid a rebate, not charged). The DISCOM's return comes from energy that would otherwise have been shed, fewer DT failures, deferred capital upgrades, and improved reliability indices. See `docs/IMPACT.md` for the actual numbers produced by `backend/app/services/economics.py`.
