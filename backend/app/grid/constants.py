"""Simulation and policy constants (docs/SPEC.md section 6).

Every later Lane A engine, and all of Lane B, imports these names verbatim --
do not rename or re-scale anything here without checking every importer.
"""

# --- Time / interval structure ---------------------------------------------
INTERVAL_MIN = 15
SLOTS_PER_DAY = 96

# --- Lifeline / consumer floor ----------------------------------------------
LIFELINE_FLOOR_W = 300

# --- Dispatcher timeline (minutes relative to window start T) --------------
NOTIFY_LEAD_MIN = 120
NOTICE_MIN_CAPS = 30  # hard invariant: no cap command with < 30 min notice
APPROVAL_DEADLINE_MIN = 15
SIGNAL_LEAD_MIN = 30
HES_LEAD_MIN = 15
VERIFY_DELAY_MIN = 15

# --- Forecast / planning horizons (in 15-min slots) -------------------------
FORECAST_HORIZON_SLOTS = 144  # 36h
PLAN_HORIZON_SLOTS = 96  # 24h
MAX_WINDOW_SLOTS = 24  # 6h
ROSTER_MIN_SLOTS = 4  # 1h

# --- Transformer thermal limits ---------------------------------------------
HOTSPOT_LIMIT_C = 120
HOTSPOT_ALARM_C = 110
TRIP_LOADING_PU = 1.30
TRIP_INTERVALS = 2
TRIP_OUTAGE_INTERVALS = 8  # 2h

# --- LV power-flow voltage band ----------------------------------------------
V_MIN_PU = 0.94
V_MAX_PU = 1.06

# --- Compliance / rebound / shedding ----------------------------------------
CAP_COMPLIANCE = 0.92
CAP_TRIP_SHARE = 0.08
REBOUND_SHARE = 0.30
REBOUND_RELEASE = 0.15
SHED_TOLERANCE_FRAC = 0.03

# --- Money / protocol ---------------------------------------------------------
DR_REBATE_RS_PER_KWH = 2.0
HES_ACK_PROB = 0.97
P2P_CHARGE_RS_PER_KWH = 0.42

# --- Geography ----------------------------------------------------------------
SUBDIVISION_IDS: tuple[str, ...] = (
    "sd_subhashnagar",
    "sd_izzatnagar",
    "sd_faridpur",
    "sd_krishnanagar",
    "sd_kosikalan",
)

DISCOM_IDS: tuple[str, ...] = ("mvvnl_bareilly", "dvvnl_mathura")

# Sub-division -> (discom, town) mapping.
SUBDIVISION_DISCOM: dict[str, str] = {
    "sd_subhashnagar": "mvvnl_bareilly",
    "sd_izzatnagar": "mvvnl_bareilly",
    "sd_faridpur": "mvvnl_bareilly",
    "sd_krishnanagar": "dvvnl_mathura",
    "sd_kosikalan": "dvvnl_mathura",
}

# --- Lever order (always tried in this sequence) ----------------------------
LEVER_ORDER: tuple[str, ...] = (
    "dr",  # L1 Behavioural DR
    "hub",  # L2 Managed charging
    "shift",  # L3 Shiftable public loads
    "storage",  # L4 Existing storage discharge
    "cap",  # L5 Lifeline caps
    "shed",  # L6 Status quo / rotational shedding (last resort)
)

# --- Card footer source-citation constants ----------------------------------
SOURCE_SIM = "sim"
SOURCE_FORECAST = "forecast"

# --- Tier floors (watts), by cap level --------------------------------------
# Cap level -> {tier -> watt cap}. Level 0 = None (uncapped).
CAP_LEVEL_WATTS: dict[int, dict[str, int]] = {
    0: {"t1": 0, "t2": 0},  # uncapped; 0 means "no cap applied"
    1: {"t1": 1000, "t2": 2000},  # Comfort
    2: {"t1": 500, "t2": 1000},  # Essential
    3: {"t1": LIFELINE_FLOOR_W, "t2": 500},  # Lifeline
}

TIER_LIFELINE_FLOOR_W: dict[str, int] = {
    "t1": 300,
    "t2": 500,
}
