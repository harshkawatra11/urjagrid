"""Pure read-model functions (Lane B, task B8) -- the wire contract.

Every function here takes plain domain objects (Lane A's ``NetworkData``/
``SyntheticNetwork``, Lane B's ``GridService``/``FlexPlanService``/
``ProtocolLedger``) and returns JSON-ready ``dict``/``list[dict]`` values:
no numpy arrays, no raw ``datetime`` objects (always ISO strings), no
pydantic model instances (always ``.model_dump(mode="json")``'d first). This
is the exact shape Lane C/D's frontend TypeScript types mirror and the
fixtures export script (B13) freezes to JSON, so changing a key name here is
a cross-lane breaking change.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np

from app.grid.constants import DR_REBATE_RS_PER_KWH, INTERVAL_MIN, P2P_CHARGE_RS_PER_KWH
from app.grid.models import FlexPlan, LeverKey, PlanStatus
from app.grid.network import NetworkData, SyntheticNetwork, bounded_voronoi
from app.grid.risk import DtRisk, compute_dt_risk

AnyNetwork = NetworkData | SyntheticNetwork

# Wire-level field names below are written directly in camelCase (rather than
# relying on a blanket snake_case->camelCase response transform) because several
# of these dicts are *also* keyed by domain ids (dt_id, consumer_id, ...) that
# must never be re-cased -- see docs note in the frontend integration pass.


def _dt_subdivision_map(network: AnyNetwork) -> dict[str, str]:
    return dict(network.dt_subdivision)


def subdivisions_view(network: AnyNetwork) -> list[dict[str, Any]]:
    discom_by_sub = (
        network.discom_by_subdivision
        if isinstance(network, NetworkData)
        else dict.fromkeys(network.subdivision_ids, "mvvnl_bareilly")
    )
    dt_counts: dict[str, int] = {}
    for _dt_id, sub_id in network.dt_subdivision.items():
        dt_counts[sub_id] = dt_counts.get(sub_id, 0) + 1
    feeder_counts: dict[str, int] = {}
    for _fdr_id, sub_id in network.feeder_subdivision.items():
        feeder_counts[sub_id] = feeder_counts.get(sub_id, 0) + 1

    return [
        {
            "id": sub_id,
            "discomId": discom_by_sub.get(sub_id, ""),
            "feederCount": feeder_counts.get(sub_id, 0),
            "transformerCount": dt_counts.get(sub_id, 0),
        }
        for sub_id in network.subdivision_ids
    ]


def feeders_view(network: AnyNetwork, subdivision_id: str | None = None) -> list[dict[str, Any]]:
    dt_counts: dict[str, int] = {}
    for _dt_id, fdr_id in network.dt_feeder.items():
        dt_counts[fdr_id] = dt_counts.get(fdr_id, 0) + 1
    rows = [
        {
            "id": fdr_id,
            "subdivisionId": network.feeder_subdivision[fdr_id],
            "transformerCount": dt_counts.get(fdr_id, 0),
        }
        for fdr_id in network.feeder_ids
    ]
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivisionId"] == subdivision_id]
    return rows


class DtTelemetry:
    """Bundle of the live per-DT dicts ``GridService`` caches from the most
    recent interval (``latest_dt_loading_pu``/``latest_dt_hotspot_c``/
    ``latest_dt_voltage_pu``/``latest_dt_served_kw``/``latest_dt_demand_kw``)
    plus the world's cumulative loss-of-life hours -- bundled into one object
    so `transformers_view`/`transformer_detail_view` don't need five separate
    optional-dict parameters. All empty/``None`` before the first interval
    (fresh boot), consistent with the documented "world restarts from
    scenario start" limitation.
    """

    def __init__(
        self,
        loading_pu: dict[str, float] | None = None,
        hotspot_c: dict[str, float] | None = None,
        voltage_pu: dict[str, float] | None = None,
        served_kw: dict[str, float] | None = None,
        demand_kw: dict[str, float] | None = None,
        loss_of_life_hours: dict[str, float] | None = None,
    ) -> None:
        self.loading_pu = loading_pu or {}
        self.hotspot_c = hotspot_c or {}
        self.voltage_pu = voltage_pu or {}
        self.served_kw = served_kw or {}
        self.demand_kw = demand_kw or {}
        self.loss_of_life_hours = loss_of_life_hours or {}


# Rated transformer life used to turn cumulative loss-of-life *hours*
# (IEEE C57.91 ageing-factor-weighted, see `grid/thermal.py`) into a
# percentage -- a standard 20-year (175,200 h) rating, documented since
# there's no separate "rated life" constant elsewhere in this prototype.
_RATED_LIFE_HOURS = 20 * 365.25 * 24


def _dt_risk_row(
    dt_id: str, network: AnyNetwork, telemetry: DtTelemetry
) -> dict[str, Any]:
    hotspot_c = telemetry.hotspot_c.get(dt_id, 30.0)
    rating_kva = network.dt_rating_kva[dt_id]
    ageing = telemetry.loss_of_life_hours.get(dt_id, 0.0) / _RATED_LIFE_HOURS * 100.0 + 1.0
    # forecast_gap_kw isn't available at this read-model layer; see
    # services/service.py#risk_summary, which makes the same simplification.
    risk = compute_dt_risk(
        dt_id=dt_id,
        hot_spot_c=hotspot_c,
        forecast_gap_kw=0.0,
        dt_limit_kw=rating_kva,
        ageing_factor=ageing,
    )
    return {"level": risk.level.value, "index": round(risk.score, 4)}


def _dt_voronoi_polygons(network: AnyNetwork) -> dict[str, list[dict[str, float]]]:
    """Real Voronoi service-area polygons for every DT (`network.bounded_voronoi`,
    A3), keyed by dt id. Computed once over the whole network per call.
    """
    dt_ids = list(network.dt_ids)
    if not dt_ids:
        return {}
    lats = [network.dt_lat[d] for d in dt_ids]
    lons = [network.dt_lon[d] for d in dt_ids]
    pad_lat = max((max(lats) - min(lats)) * 0.1, 0.01)
    pad_lon = max((max(lons) - min(lons)) * 0.1, 0.01)
    bbox = (min(lons) - pad_lon, max(lons) + pad_lon, min(lats) - pad_lat, max(lats) + pad_lat)
    points = [(network.dt_lon[d], network.dt_lat[d]) for d in dt_ids]
    polygons = bounded_voronoi(np.asarray(points), bbox)
    return {
        dt_id: [{"lat": round(float(v[1]), 6), "lng": round(float(v[0]), 6)} for v in poly]
        for dt_id, poly in zip(dt_ids, polygons, strict=True)
    }


def transformers_view(
    network: AnyNetwork,
    subdivision_id: str | None = None,
    live_loading_pu: dict[str, float] | None = None,
    live_hotspot_c: dict[str, float] | None = None,
    telemetry: DtTelemetry | None = None,
    with_polygons: bool = False,
) -> list[dict[str, Any]]:
    telemetry = telemetry or DtTelemetry(live_loading_pu, live_hotspot_c)
    consumers_by_dt = _consumer_counts_by_dt(network)
    polygons = _dt_voronoi_polygons(network) if with_polygons else {}
    rows = [
        _dt_row(dt_id, network, telemetry, consumers_by_dt, polygons) for dt_id in network.dt_ids
    ]
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivisionId"] == subdivision_id]
    return rows


def _dt_row(
    dt_id: str,
    network: AnyNetwork,
    telemetry: DtTelemetry,
    consumers_by_dt: dict[str, int],
    polygons: dict[str, list[dict[str, float]]],
) -> dict[str, Any]:
    served = telemetry.served_kw.get(dt_id)
    demand = telemetry.demand_kw.get(dt_id)
    served_fraction = (served / demand) if served is not None and demand else None
    risk = _dt_risk_row(dt_id, network, telemetry)
    loss_of_life_pct = round(
        min(telemetry.loss_of_life_hours.get(dt_id, 0.0) / _RATED_LIFE_HOURS * 100.0, 100.0), 4
    )
    return {
        "id": dt_id,
        "feederId": network.dt_feeder[dt_id],
        "subdivisionId": network.dt_subdivision[dt_id],
        "name": f"Transformer {dt_id}",
        "ratingKva": network.dt_rating_kva[dt_id],
        "loadingPu": telemetry.loading_pu.get(dt_id),
        "hotspotC": telemetry.hotspot_c.get(dt_id),
        "lossOfLifePct": loss_of_life_pct,
        "riskLevel": risk["level"],
        "riskIndex": risk["index"],
        "consumerCount": consumers_by_dt.get(dt_id, 0),
        "servedFraction": round(served_fraction, 4) if served_fraction is not None else None,
        "voltagePu": telemetry.voltage_pu.get(dt_id),
        "location": {"lat": network.dt_lat[dt_id], "lng": network.dt_lon[dt_id]},
        "serviceAreaPolygon": polygons.get(dt_id, []),
    }


def transformer_detail_view(
    network: AnyNetwork,
    dt_id: str,
    live_loading_pu: float | None = None,
    live_hotspot_c: float | None = None,
    telemetry: DtTelemetry | None = None,
) -> dict[str, Any] | None:
    if dt_id not in network.dt_ids:
        return None
    if telemetry is None:
        telemetry = DtTelemetry(
            {dt_id: live_loading_pu} if live_loading_pu is not None else {},
            {dt_id: live_hotspot_c} if live_hotspot_c is not None else {},
        )
    consumers_by_dt = _consumer_counts_by_dt(network)
    polygons = _dt_voronoi_polygons(network)
    return _dt_row(dt_id, network, telemetry, consumers_by_dt, polygons)


def geo_view(network: AnyNetwork) -> dict[str, Any]:
    """Point geometry for every feeder/DT, map-layer ready (no polygons here --
    Voronoi service-area polygons are computed on demand by the caller via
    ``network.bounded_voronoi``, this view only carries point geometry).
    """
    return {
        "transformers": [
            {
                "id": dt_id,
                "subdivisionId": network.dt_subdivision[dt_id],
                "lat": network.dt_lat[dt_id],
                "lon": network.dt_lon[dt_id],
            }
            for dt_id in network.dt_ids
        ],
    }


def risk_view(risks: list[DtRisk]) -> list[dict[str, Any]]:
    return [
        {
            "dtId": r.dt_id,
            "score": round(r.score, 4),
            "level": r.level.value,
            "thermalComponent": round(r.thermal_component, 4),
            "gapComponent": round(r.gap_component, 4),
            "ageingComponent": round(r.ageing_component, 4),
        }
        for r in risks
    ]


# ---------------------------------------------------------------------------
# Flex Plan view -- translates the internal MILP-optimiser-shaped ``FlexPlan``
# (per-DT dicts, slot indices) into the flattened, frontend-vocabulary
# contract `frontend/src/lib/api/types.ts#FlexPlan` expects (one summary
# number per plan, a `levers: LeverAllocation[]` array, ISO timestamps).
# ---------------------------------------------------------------------------

# Maps the engine's internal ``LeverKey``/``PlanStatus`` enum values (shared
# with the optimiser, dispatcher and B7 safety-invariant tests -- not safe to
# rename) to the wire vocabulary `frontend/src/lib/domain.ts` defines. Both
# sides agree on the *order* (L1 behavioural DR .. L6 rotational shedding);
# only the string spelling differs.
_LEVER_WIRE: dict[LeverKey, str] = {
    LeverKey.DR: "behavioral_dr",
    LeverKey.HUB: "managed_charging",
    LeverKey.SHIFT: "shiftable_loads",
    LeverKey.STORAGE: "storage_discharge",
    LeverKey.CAP: "lifeline_cap",
    LeverKey.SHED: "rotational_shedding",
}

_PLAN_STATUS_WIRE: dict[PlanStatus, str] = {
    PlanStatus.DRAFT: "draft",
    PlanStatus.APPROVED: "approved",
    PlanStatus.REJECTED: "rejected",
    PlanStatus.CANCELLED: "cancelled",
    PlanStatus.DISPATCHED: "dispatched",
    PlanStatus.COMPLETED: "verified",  # M&V-confirmed, closest frontend vocabulary match
    PlanStatus.EXPIRED: "expired",
}

# Mirrors ``actions_from_plan_solution`` in services/service.py: the fraction
# of a DT's rated capacity a cap level actually relieves.
_CAP_RELIEF_FRACTION = {1: 0.25, 2: 0.55, 3: 0.85}

# Synthetic epoch for turning a plan's slot indices into ISO timestamps.
# ``FlexPlan``/``PlanInputs`` only carry slot *indices* (ints), not an
# absolute scenario start date, so this is a display convenience, not a
# wall-clock fact -- consistent with the rest of the prototype's documented
# "world restarts from scenario start" limitation.
_SLOT_EPOCH = datetime(2025, 1, 1, tzinfo=UTC)


def _slot_iso(slot: int) -> str:
    return (_SLOT_EPOCH + timedelta(minutes=INTERVAL_MIN * slot)).isoformat()


def _consumer_counts_by_dt(network: AnyNetwork | None) -> dict[str, int]:
    if network is None:
        return {}
    consumers = getattr(network, "consumers", None)
    if consumers is None:
        return {}
    counts: dict[str, int] = {}
    for dt_id in consumers.dt_ids:
        key = str(dt_id)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _lever_allocations(plan: FlexPlan, consumers_by_dt: dict[str, int]) -> list[dict[str, Any]]:
    inputs, solution = plan.inputs, plan.solution
    n_slots = max((len(s) for s in inputs.gap_kw.values()), default=0)
    hours = n_slots * INTERVAL_MIN / 60.0
    rows: list[dict[str, Any]] = []

    dr_dts = [d for d in inputs.dt_ids if solution.dr_on_by_dt.get(d)]
    if dr_dts:
        relief = sum(inputs.dr_potential_kw.get(d, 0.0) for d in dr_dts)
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.DR],
                "reliefKw": round(relief, 2),
                "costRs": round(relief * hours * DR_REBATE_RS_PER_KWH, 2),
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in dr_dts),
            }
        )

    hub_dts = [d for d in inputs.dt_ids if solution.hub_frac_by_dt.get(d, 1.0) < 1.0]
    if hub_dts:
        relief = sum(
            inputs.hub_potential_kw.get(d, 0.0) * (1.0 - solution.hub_frac_by_dt.get(d, 1.0))
            for d in hub_dts
        )
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.HUB],
                "reliefKw": round(relief, 2),
                "costRs": 0.0,
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in hub_dts),
            }
        )

    shift_dts = [d for d in inputs.dt_ids if solution.shift_on_by_dt.get(d, True) is False]
    if shift_dts:
        relief = sum(inputs.shift_potential_kw.get(d, 0.0) for d in shift_dts)
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.SHIFT],
                "reliefKw": round(relief, 2),
                "costRs": 0.0,
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in shift_dts),
            }
        )

    storage_dts = [d for d, kw in solution.storage_kw_by_dt.items() if kw > 0]
    if storage_dts:
        relief = sum(solution.storage_kw_by_dt[d] for d in storage_dts)
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.STORAGE],
                "reliefKw": round(relief, 2),
                "costRs": round(relief * hours * P2P_CHARGE_RS_PER_KWH, 2),
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in storage_dts),
            }
        )

    cap_dts = [d for d, lvl in solution.cap_level_by_dt.items() if lvl > 0]
    if cap_dts:
        relief = sum(
            inputs.dt_limit_kw.get(d, 0.0)
            * _CAP_RELIEF_FRACTION.get(solution.cap_level_by_dt[d], 0.0)
            for d in cap_dts
        )
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.CAP],
                "reliefKw": round(relief, 2),
                "costRs": 0.0,
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in cap_dts),
            }
        )

    shed_dts = [d for d, kw in solution.unserved_kw_by_dt.items() if kw > 0]
    if shed_dts:
        relief = sum(solution.unserved_kw_by_dt[d] for d in shed_dts)
        rows.append(
            {
                "lever": _LEVER_WIRE[LeverKey.SHED],
                "reliefKw": round(relief, 2),
                "costRs": 0.0,
                "consumerCount": sum(consumers_by_dt.get(d, 0) for d in shed_dts),
            }
        )

    return rows


def plan_view(plan: FlexPlan, network: AnyNetwork | None = None) -> dict[str, Any]:
    inputs, solution = plan.inputs, plan.solution
    slots = inputs.slots
    window_start = min(slots) if slots else 0
    window_end = (max(slots) + 1) if slots else 0

    n = max((len(s) for s in inputs.gap_kw.values()), default=0)
    total_gap = [
        sum(series[i] for series in inputs.gap_kw.values() if i < len(series)) for i in range(n)
    ]
    gap_kw = max(total_gap) if total_gap else 0.0
    unserved_total = sum(solution.unserved_kw_by_dt.values())
    covered_kw = max(gap_kw - unserved_total, 0.0)

    approved_iso = (
        plan.updated_at.isoformat()
        if plan.status in (PlanStatus.APPROVED, PlanStatus.DISPATCHED, PlanStatus.COMPLETED)
        else None
    )
    notes = plan.overrides.notes or plan.rejected_reason or None

    return {
        "id": plan.id,
        "subdivisionId": plan.subdivision_id,
        "dtIds": list(inputs.dt_ids),
        "status": _PLAN_STATUS_WIRE[plan.status],
        "deficitWindowId": plan.window_id,
        "createdIso": plan.created_at.isoformat(),
        "windowStartIso": _slot_iso(window_start),
        "windowEndIso": _slot_iso(window_end),
        "gapKw": round(gap_kw, 3),
        "coveredKw": round(covered_kw, 3),
        "levers": _lever_allocations(plan, _consumer_counts_by_dt(network)),
        "approverName": plan.approved_by,
        "approvedIso": approved_iso,
        "notes": notes,
    }


def plans_view(plans: list[FlexPlan], network: AnyNetwork | None = None) -> list[dict[str, Any]]:
    return [plan_view(p, network) for p in plans]


def protocol_ledger_view(entries: list[Any]) -> list[dict[str, Any]]:
    return [e.to_view() for e in entries]


def consumers_sample_view(
    network: SyntheticNetwork, subdivision_id: str | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    consumers = network.consumers
    rows: list[dict[str, Any]] = []
    for i in range(len(consumers)):
        sub_id = str(consumers.subdivision_ids[i])
        if subdivision_id is not None and sub_id != subdivision_id:
            continue
        rows.append(
            {
                "id": str(consumers.consumer_ids[i]),
                "dtId": str(consumers.dt_ids[i]),
                "subdivisionId": sub_id,
                "tier": str(consumers.tier[i]),
                "archetype": str(consumers.archetype[i]),
                "lat": float(consumers.lat[i]),
                "lon": float(consumers.lon[i]),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def critical_facilities_view(network: SyntheticNetwork) -> list[dict[str, Any]]:
    """T0 (critical/life-support) consumers -- never capped/asked/shed."""
    return [row for row in consumers_sample_view(network, limit=10_000) if row["tier"] == "t0"]


__all__ = [
    "subdivisions_view",
    "feeders_view",
    "transformers_view",
    "transformer_detail_view",
    "geo_view",
    "risk_view",
    "plan_view",
    "plans_view",
    "protocol_ledger_view",
    "consumers_sample_view",
    "critical_facilities_view",
]
