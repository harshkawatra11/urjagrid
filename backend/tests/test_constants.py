from app.grid import constants as c


def test_interval_and_horizon_constants() -> None:
    assert c.INTERVAL_MIN == 15
    assert c.SLOTS_PER_DAY == 96
    assert c.FORECAST_HORIZON_SLOTS == 144
    assert c.PLAN_HORIZON_SLOTS == 96
    assert c.MAX_WINDOW_SLOTS == 24
    assert c.ROSTER_MIN_SLOTS == 4


def test_dispatcher_timeline_constants() -> None:
    assert c.NOTIFY_LEAD_MIN == 120
    assert c.NOTICE_MIN_CAPS == 30
    assert c.APPROVAL_DEADLINE_MIN == 15
    assert c.SIGNAL_LEAD_MIN == 30
    assert c.HES_LEAD_MIN == 15
    assert c.VERIFY_DELAY_MIN == 15


def test_thermal_and_voltage_constants() -> None:
    assert c.HOTSPOT_LIMIT_C == 120
    assert c.HOTSPOT_ALARM_C == 110
    assert c.TRIP_LOADING_PU == 1.30
    assert c.TRIP_INTERVALS == 2
    assert c.TRIP_OUTAGE_INTERVALS == 8
    assert c.V_MIN_PU == 0.94
    assert c.V_MAX_PU == 1.06


def test_compliance_and_money_constants() -> None:
    assert c.CAP_COMPLIANCE == 0.92
    assert c.CAP_TRIP_SHARE == 0.08
    assert c.REBOUND_SHARE == 0.30
    assert c.REBOUND_RELEASE == 0.15
    assert c.SHED_TOLERANCE_FRAC == 0.03
    assert c.DR_REBATE_RS_PER_KWH == 2.0
    assert c.HES_ACK_PROB == 0.97
    assert c.P2P_CHARGE_RS_PER_KWH == 0.42
    assert c.LIFELINE_FLOOR_W == 300


def test_subdivision_ids() -> None:
    assert c.SUBDIVISION_IDS == (
        "sd_subhashnagar",
        "sd_izzatnagar",
        "sd_faridpur",
        "sd_krishnanagar",
        "sd_kosikalan",
    )
    assert len(c.SUBDIVISION_IDS) == 5
    for sd in c.SUBDIVISION_IDS:
        assert sd in c.SUBDIVISION_DISCOM


def test_lever_order() -> None:
    assert c.LEVER_ORDER == ("dr", "hub", "shift", "storage", "cap", "shed")
