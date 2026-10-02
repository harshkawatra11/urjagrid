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

from typing import Any

from app.grid.models import FlexPlan
from app.grid.network import NetworkData, SyntheticNetwork
from app.grid.risk import DtRisk

AnyNetwork = NetworkData | SyntheticNetwork


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
            "discom_id": discom_by_sub.get(sub_id, ""),
            "feeder_count": feeder_counts.get(sub_id, 0),
            "transformer_count": dt_counts.get(sub_id, 0),
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
            "subdivision_id": network.feeder_subdivision[fdr_id],
            "transformer_count": dt_counts.get(fdr_id, 0),
        }
        for fdr_id in network.feeder_ids
    ]
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivision_id"] == subdivision_id]
    return rows


def transformers_view(
    network: AnyNetwork,
    subdivision_id: str | None = None,
    live_loading_pu: dict[str, float] | None = None,
    live_hotspot_c: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    live_loading_pu = live_loading_pu or {}
    live_hotspot_c = live_hotspot_c or {}
    rows = [
        {
            "id": dt_id,
            "feeder_id": network.dt_feeder[dt_id],
            "subdivision_id": network.dt_subdivision[dt_id],
            "rating_kva": network.dt_rating_kva[dt_id],
            "lat": network.dt_lat[dt_id],
            "lon": network.dt_lon[dt_id],
            "loading_pu": live_loading_pu.get(dt_id),
            "hotspot_c": live_hotspot_c.get(dt_id),
        }
        for dt_id in network.dt_ids
    ]
    if subdivision_id is not None:
        rows = [r for r in rows if r["subdivision_id"] == subdivision_id]
    return rows


def transformer_detail_view(network: AnyNetwork, dt_id: str) -> dict[str, Any] | None:
    if dt_id not in network.dt_ids:
        return None
    return {
        "id": dt_id,
        "feeder_id": network.dt_feeder[dt_id],
        "subdivision_id": network.dt_subdivision[dt_id],
        "rating_kva": network.dt_rating_kva[dt_id],
        "lat": network.dt_lat[dt_id],
        "lon": network.dt_lon[dt_id],
    }


def geo_view(network: AnyNetwork) -> dict[str, Any]:
    """Point geometry for every feeder/DT, map-layer ready (no polygons here --
    Voronoi service-area polygons are computed on demand by the caller via
    ``network.bounded_voronoi``, this view only carries point geometry).
    """
    return {
        "transformers": [
            {
                "id": dt_id,
                "subdivision_id": network.dt_subdivision[dt_id],
                "lat": network.dt_lat[dt_id],
                "lon": network.dt_lon[dt_id],
            }
            for dt_id in network.dt_ids
        ],
    }


def risk_view(risks: list[DtRisk]) -> list[dict[str, Any]]:
    return [
        {
            "dt_id": r.dt_id,
            "score": round(r.score, 4),
            "level": r.level.value,
            "thermal_component": round(r.thermal_component, 4),
            "gap_component": round(r.gap_component, 4),
            "ageing_component": round(r.ageing_component, 4),
        }
        for r in risks
    ]


def plan_view(plan: FlexPlan) -> dict[str, Any]:
    return plan.model_dump(mode="json")


def plans_view(plans: list[FlexPlan]) -> list[dict[str, Any]]:
    return [plan_view(p) for p in plans]


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
                "dt_id": str(consumers.dt_ids[i]),
                "subdivision_id": sub_id,
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
