"""Pydantic domain models and enums (docs/SPEC.md section 5).

These are the cross-lane contract value objects: Lane B's ``GridWorld`` /
``GridService`` / ``FlexPlanService`` are behaviour classes owned by Lane B,
but the inputs/outputs they pass around (and that Lane A's engines in
A9-A12 produce/consume) are defined here so every lane imports the exact
same names and shapes.

All arrays are plain ``list[float]`` (JSON-serialisable) rather than numpy
arrays -- engines internally use numpy, but these wire-level models stay
framework/runtime agnostic.
"""

from datetime import UTC, datetime
from enum import Enum, IntEnum

from pydantic import BaseModel, Field

from app.grid.constants import FORECAST_HORIZON_SLOTS, SUBDIVISION_IDS

__all__ = [
    "SUBDIVISION_IDS",
    "RiskLevel",
    "PlanStatus",
    "MeterState",
    "LeverKey",
    "CapLevel",
    "Actions",
    "IntervalResult",
    "LogRow",
    "ForecastBundle",
    "PlanInputs",
    "PlanSolution",
    "PlanOverrides",
    "FlexPlan",
]


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class RiskLevel(str, Enum):
    """DT/feeder/sub-division risk tier, driven by thermal + forecast headroom."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PlanStatus(str, Enum):
    """``FlexPlanService`` state-machine states."""

    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    EXPIRED = "expired"


class MeterState(str, Enum):
    """Per-consumer meter state as seen by HES/the dashboard."""

    NORMAL = "normal"
    DR_ACTIVE = "dr_active"
    CAPPED = "capped"
    SHED = "shed"
    CRITICAL_BACKUP = "critical_backup"


class LeverKey(str, Enum):
    """Canonical lever identifiers -- must match ``LEVER_ORDER`` exactly."""

    DR = "dr"
    HUB = "hub"
    SHIFT = "shift"
    STORAGE = "storage"
    CAP = "cap"
    SHED = "shed"


class CapLevel(IntEnum):
    """Lifeline cap severity. 0 = uncapped; 3 = lifeline floor."""

    NONE = 0
    COMFORT = 1
    ESSENTIAL = 2
    LIFELINE = 3


# ---------------------------------------------------------------------------
# Simulation value objects
# ---------------------------------------------------------------------------


class Actions(BaseModel):
    """Per-interval control vector applied to one DT's service area.

    Every mapping is keyed by the id of the thing being controlled (DT id
    for ``cap_kw``/``cap_started``, consumer id for ``dr_on``, hub id for
    ``hub_frac``, storage asset id for ``storage_kw``, shiftable-load id for
    ``shift_on``) so a single ``Actions`` instance can describe one DT's
    entire lever state for one interval.
    """

    cap_kw: dict[str, float] = Field(default_factory=dict, description="DT id -> cap limit kW")
    cap_started: dict[str, bool] = Field(
        default_factory=dict, description="DT id -> cap newly started this interval"
    )
    dr_on: dict[str, bool] = Field(
        default_factory=dict, description="consumer id -> DR ask currently active"
    )
    hub_frac: dict[str, float] = Field(
        default_factory=dict, description="hub id -> fraction of rated charging power allowed"
    )
    storage_kw: dict[str, float] = Field(
        default_factory=dict, description="storage asset id -> discharge kW (positive=discharge)"
    )
    shift_on: dict[str, bool] = Field(
        default_factory=dict, description="shiftable-load id -> currently allowed to run"
    )


class IntervalResult(BaseModel):
    """One track's (solution or shadow baseline) output for one interval."""

    slot: int = Field(..., ge=0, description="Global interval index since scenario start")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    dt_demand_kw: dict[str, float] = Field(default_factory=dict)
    dt_served_kw: dict[str, float] = Field(default_factory=dict)
    dt_unserved_kw: dict[str, float] = Field(default_factory=dict)
    dt_hotspot_c: dict[str, float] = Field(default_factory=dict)
    dt_loading_pu: dict[str, float] = Field(default_factory=dict)
    dt_voltage_pu: dict[str, float] = Field(default_factory=dict)
    actions: Actions = Field(default_factory=Actions)
    events: list[str] = Field(default_factory=list)


class LogRow(BaseModel):
    """Flattened per-interval history row consumed by chart components."""

    slot: int = Field(..., ge=0)
    timestamp: datetime
    subdivision_id: str
    gross_kw: float
    net_kw: float
    available_kw: float
    served_kw: float
    unserved_kw: float
    overload_dt_count: int = 0
    hotspot_max_c: float = 0.0
    voltage_min_pu: float = 1.0
    is_shadow: bool = False


class ForecastBundle(BaseModel):
    """Gross/net/available-kW arrays + gap_kw per sub-division for the 36h horizon."""

    subdivision_id: str
    horizon_slots: int = FORECAST_HORIZON_SLOTS
    dt_ids: list[str] = Field(default_factory=list)
    gross_kw: list[float] = Field(default_factory=list)
    net_kw: list[float] = Field(default_factory=list)
    available_kw: list[float] = Field(default_factory=list)
    gap_kw: list[float] = Field(default_factory=list)
    p10_kw: list[float] = Field(default_factory=list)
    p50_kw: list[float] = Field(default_factory=list)
    p90_kw: list[float] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ---------------------------------------------------------------------------
# Flex Plan optimiser value objects
# ---------------------------------------------------------------------------


class PlanInputs(BaseModel):
    """MILP optimiser input bundle for a single deficit window."""

    window_id: str
    subdivision_id: str
    slots: list[int] = Field(default_factory=list)
    dt_ids: list[str] = Field(default_factory=list)
    gap_kw: dict[str, list[float]] = Field(
        default_factory=dict, description="DT id -> gap kW per slot in `slots`"
    )
    dt_limit_kw: dict[str, float] = Field(default_factory=dict)
    dr_potential_kw: dict[str, float] = Field(default_factory=dict)
    hub_potential_kw: dict[str, float] = Field(default_factory=dict)
    storage_energy_kwh: dict[str, float] = Field(default_factory=dict)
    shift_potential_kw: dict[str, float] = Field(default_factory=dict)
    cap_cost_weight: float = 1.0
    unserved_penalty_weight: float = 50.0
    overload_penalty_weight: float = 100.0


class PlanSolution(BaseModel):
    """MILP (or greedy-fallback) optimiser output for one ``PlanInputs``."""

    window_id: str
    status: str = Field(..., description="'optimal' | 'feasible' | 'greedy_fallback' | 'infeasible'")
    objective_value: float = 0.0
    cap_level_by_dt: dict[str, int] = Field(default_factory=dict)
    hub_frac_by_dt: dict[str, float] = Field(default_factory=dict)
    storage_kw_by_dt: dict[str, float] = Field(default_factory=dict)
    shift_on_by_dt: dict[str, bool] = Field(default_factory=dict)
    dr_on_by_dt: dict[str, bool] = Field(default_factory=dict)
    unserved_kw_by_dt: dict[str, float] = Field(default_factory=dict)
    overload_kw_by_dt: dict[str, float] = Field(default_factory=dict)
    solve_seconds: float = 0.0


class PlanOverrides(BaseModel):
    """JE/AE what-if overrides applied on top of a ``PlanSolution`` before dispatch."""

    cap_level_overrides: dict[str, int] = Field(default_factory=dict)
    disabled_levers: list[LeverKey] = Field(default_factory=list)
    window_start_slot: int | None = None
    window_end_slot: int | None = None
    notes: str = ""


class FlexPlan(BaseModel):
    """Persisted / wire-level Flex Plan object (id convention: ``fp_<8hex>``)."""

    id: str
    subdivision_id: str
    window_id: str
    status: PlanStatus = PlanStatus.DRAFT
    lever_sequence: list[LeverKey] = Field(default_factory=list)
    inputs: PlanInputs
    solution: PlanSolution
    overrides: PlanOverrides = Field(default_factory=PlanOverrides)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    approved_by: str | None = None
    rejected_reason: str | None = None
