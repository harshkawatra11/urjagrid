"""``GridService`` (Lane B, task B5): boots a scenario, owns the real-time
tick loop, and orchestrates ``GridWorld`` + ``FlexPlanService`` + ``Dispatcher``.

Runtime model (docs/SPEC.md section 4, B5): one real second per ``tick()``
call; ``LIFELINE_TIME_SCALE`` sim-seconds pass per real second (default 60,
so one 15-minute interval every 15 real seconds). Crossing an interval
boundary calls ``world.advance_interval``; crossing an hour boundary
re-evaluates deficit windows via ``FlexPlanService.refresh_from_series``.

Known limitation (documented per spec rather than engineered around): on a
Cloud Run cold start the process restarts from the scenario's start -- there
is no durable sim-state database, only the best-effort JSON snapshot in
``store.py``, written at most once every 5 real seconds while dirty.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import numpy as np

from app.adapters.channels import ChannelGateway
from app.adapters.hes import MockHes
from app.adapters.ledger import ProtocolLedger
from app.adapters.ocpp import MockChargePoint
from app.adapters.openadr import OpenAdrVtn
from app.grid.constants import (
    INTERVAL_MIN,
)
from app.grid.fairness import jain_index
from app.grid.loadgen import LoadModel
from app.grid.metrics import hours_of_hardship, lifeline_availability
from app.grid.models import Actions, LogRow, PlanStatus
from app.grid.network import SyntheticNetwork, real_network, synthetic_network
from app.grid.planner import FlexPlanService
from app.grid.risk import compute_dt_risk, rank_by_risk
from app.grid.supply import supply_fraction_for_subdivision
from app.grid.weather import WeatherSeries, synthetic_series
from app.grid.world import DtStatic, GridWorld
from app.services.dispatch import Dispatcher

SCENARIO_START_IST_HOUR = 0  # slot 0 == 00:00 IST of the scenario's single simulated day


def actions_from_plan_solution(dt_id: str, rated_kw: float, solution) -> Actions:  # type: ignore[no-untyped-def]
    """Translate one DT's slice of a ``PlanSolution`` into the ``Actions`` the
    world applies this interval (DT-aggregate simplification, see world.py).
    """
    cap_level = solution.cap_level_by_dt.get(dt_id, 0)
    cap_kw: dict[str, float] = {}
    cap_started: dict[str, bool] = {}
    if cap_level > 0:
        relief_fraction = {1: 0.25, 2: 0.55, 3: 0.85}[cap_level]
        cap_kw[dt_id] = rated_kw * (1.0 - relief_fraction)
        cap_started[dt_id] = True
    dr_on = {dt_id: bool(solution.dr_on_by_dt.get(dt_id, False))}
    hub_frac = {dt_id: float(solution.hub_frac_by_dt.get(dt_id, 1.0))}
    storage_kw = {f"{dt_id}_storage": float(solution.storage_kw_by_dt.get(dt_id, 0.0))}
    shift_on = {dt_id: bool(solution.shift_on_by_dt.get(dt_id, True))}
    return Actions(
        cap_kw=cap_kw,
        cap_started=cap_started,
        dr_on=dr_on,
        hub_frac=hub_frac,
        storage_kw=storage_kw,
        shift_on=shift_on,
    )


@dataclass
class ScenarioData:
    network: SyntheticNetwork
    weather: WeatherSeries
    dt_gross_kw: dict[str, np.ndarray]
    dt_ambient_c: dict[str, np.ndarray]
    dt_available_kw: dict[str, np.ndarray]


def build_scenario(
    seed: int = 0, scenario_name: str = "synthetic_default", use_real_network: bool = False
) -> ScenarioData:
    """Build one scenario's exogenous demand/weather/supply arrays.

    ``use_real_network`` switches between the small, fast, in-memory network
    (``synthetic_network()``, the default -- used by plain unit tests of
    ``GridWorld``/``GridService``) and the real, calibrated 48-DT/7,000-
    consumer seed network (``real_network()``) that the rest of the product
    (map, transformer directory, Scenario Lab) is sized against. At the
    synthetic network's default small/random sizing, demand never actually
    exceeds available supply, so anything that diffs a solution track against
    a shadow baseline (``services/scenario.py``'s ``run_scenario``) needs the
    real network to see a genuine deficit.
    """
    network = real_network() if use_real_network else synthetic_network(seed=seed)
    from app.grid.weather import BUILTIN_SCENARIOS

    weather = (
        BUILTIN_SCENARIOS[scenario_name].to_series()
        if scenario_name in BUILTIN_SCENARIOS
        else synthetic_series(seed=seed)
    )
    load_model = LoadModel(seed=seed)
    dt_gross_kw = load_model.generate_network_demand(network.consumers, weather)

    dt_ambient_c: dict[str, np.ndarray] = {}
    dt_available_kw: dict[str, np.ndarray] = {}
    for dt_id in network.dt_ids:
        subdivision_id = network.dt_subdivision[dt_id]
        dt_ambient_c[dt_id] = weather.temp_c
        frac = supply_fraction_for_subdivision(
            subdivision_id,
            re_share=0.15,
            solar_cf=weather.solar_cf,
            wind_cf=weather.wind_cf,
            grid_storage=0.05,
        )
        dt_available_kw[dt_id] = (
            frac * dt_gross_kw[dt_id].max() if dt_gross_kw[dt_id].max() > 0 else frac
        )

    return ScenarioData(
        network=network,
        weather=weather,
        dt_gross_kw=dt_gross_kw,
        dt_ambient_c=dt_ambient_c,
        dt_available_kw=dt_available_kw,
    )


@dataclass
class GridServiceState:
    slot: int = 0
    sim_seconds_accumulated: float = 0.0
    autopilot_enabled: bool = False
    scenario_name: str = "synthetic_default"


class GridService:
    """Owns one scenario's ``GridWorld`` + plan/dispatch services and the
    real-time tick loop that advances them.
    """

    def __init__(
        self,
        seed: int = 0,
        time_scale: int = 60,
        scenario_name: str = "synthetic_default",
        use_real_network: bool = False,
    ) -> None:
        self.seed = seed
        self.time_scale = time_scale
        self.use_real_network = use_real_network
        self.state = GridServiceState(scenario_name=scenario_name)
        self.scenario = build_scenario(
            seed=seed, scenario_name=scenario_name, use_real_network=use_real_network
        )
        self.ledger = ProtocolLedger()
        self.plan_service = FlexPlanService()
        self.dispatcher = Dispatcher(
            plan_service=self.plan_service,
            channels=ChannelGateway(self.ledger),
            hes=MockHes(self.ledger),
            charge_point=MockChargePoint(self.ledger),
            openadr_vtn=OpenAdrVtn(self.ledger),
        )
        self.dt_statics = [
            DtStatic(
                dt_id=dt_id,
                subdivision_id=self.scenario.network.dt_subdivision[dt_id],
                rating_kva=self.scenario.network.dt_rating_kva[dt_id],
            )
            for dt_id in self.scenario.network.dt_ids
        ]
        self.world = GridWorld(
            self.dt_statics,
            self.scenario.dt_gross_kw,
            self.scenario.dt_ambient_c,
            self.scenario.dt_available_kw,
        )
        self.solution_logs: list[LogRow] = []
        self.shadow_logs: list[LogRow] = []
        self.events: list[str] = []
        # Latest per-DT telemetry from the most recent interval's solution
        # track -- read by the `/transformers` views for "live" loading/
        # hot-spot numbers; empty until the first `advance_one_interval()`.
        self.latest_dt_loading_pu: dict[str, float] = {}
        self.latest_dt_hotspot_c: dict[str, float] = {}
        self.latest_dt_voltage_pu: dict[str, float] = {}
        self.latest_dt_served_kw: dict[str, float] = {}
        self.latest_dt_demand_kw: dict[str, float] = {}
        # Raw per-DT IntervalResult pairs from every `advance_one_interval()`
        # call not yet drained by the SSE stream (`services/stream.py`); the
        # aggregated LogRow pair returned by `advance_one_interval`/`tick`
        # loses the per-DT breakdown the `tick` SSE event needs.
        self._pending_interval_results: list[tuple] = []
        # DT id -> last-emitted risk level, so the SSE `risk` event can report
        # only level *transitions* (see `drain_risk_transitions`).
        self._prev_risk_levels: dict[str, str] = {}

    # -- lifecycle --------------------------------------------------------

    def boot(self) -> None:
        self.state.slot = 0
        self.state.sim_seconds_accumulated = 0.0
        self.solution_logs.clear()
        self.shadow_logs.clear()
        self._pending_interval_results.clear()

    def reset(self) -> None:
        self.__init__(
            seed=self.seed,
            time_scale=self.time_scale,
            scenario_name=self.state.scenario_name,
            use_real_network=self.use_real_network,
        )  # type: ignore[misc]

    def _active_actions(self, slot: int) -> dict[str, Actions]:
        """Levers from every live plan, restricted to the slots its own
        deficit window actually covers (``plan.inputs.slots``).

        Without this restriction a plan approved once keeps capping/DR-ing
        its DTs for every interval for as long as it stays APPROVED/
        DISPATCHED -- including the many hours of the day its window never
        covered, where there is no real deficit to relieve. That silently
        makes the solution track *worse* than the shadow baseline outside
        the window (a cap or DR ask that reduces served kW for no reason),
        which is exactly what produced a negative ``relief_kw_avoided`` for
        some scenarios once Scenario Lab plans were actually approved.
        """
        actions: dict[str, Actions] = {}
        for plan in self.plan_service.list_plans():
            if plan.status not in (PlanStatus.APPROVED, PlanStatus.DISPATCHED):
                continue
            if plan.inputs.slots and slot not in plan.inputs.slots:
                continue
            for dt_id in plan.inputs.dt_ids:
                static = next((d for d in self.dt_statics if d.dt_id == dt_id), None)
                if static is None:
                    continue
                actions[dt_id] = actions_from_plan_solution(dt_id, static.rated_kw, plan.solution)
        return actions

    def advance_one_interval(self) -> tuple[LogRow, LogRow]:
        slot = self.state.slot
        actions = self._active_actions(slot)
        sol_result, shadow_result = self.world.advance_interval(slot, actions)
        self.events.extend(sol_result.events)
        self.events.extend(shadow_result.events)
        self.latest_dt_loading_pu = dict(sol_result.dt_loading_pu)
        self.latest_dt_hotspot_c = dict(sol_result.dt_hotspot_c)
        self.latest_dt_voltage_pu = dict(sol_result.dt_voltage_pu)
        self.latest_dt_served_kw = dict(sol_result.dt_served_kw)
        self.latest_dt_demand_kw = dict(sol_result.dt_demand_kw)
        self._pending_interval_results.append((sol_result, shadow_result))

        sol_row = self._to_log_row(slot, sol_result, is_shadow=False)
        shadow_row = self._to_log_row(slot, shadow_result, is_shadow=True)
        self.solution_logs.append(sol_row)
        self.shadow_logs.append(shadow_row)
        self.state.slot += 1
        if self.state.slot % max(60 // INTERVAL_MIN, 1) == 0:
            self._refresh_plans_for_deficits()
        return sol_row, shadow_row

    def _refresh_plans_for_deficits(self) -> None:
        """Hourly deficit-window check (docs/SPEC.md B2/B5): for every
        sub-division with no live (draft/approved/dispatched) plan, look for
        a gap between gross demand and available supply over this scenario's
        demand/supply arrays and build a real draft ``FlexPlan`` for it via
        ``FlexPlanService.refresh_from_series`` -- the same engine code path
        exercised by ``test_planner.py``, just driven by the live service
        instead of a hand-built input array.
        """
        network = self.scenario.network
        live_subdivisions = {
            p.subdivision_id
            for p in self.plan_service.list_plans()
            if p.status in (PlanStatus.DRAFT, PlanStatus.APPROVED, PlanStatus.DISPATCHED)
        }
        for sub_id in network.subdivision_ids:
            if sub_id in live_subdivisions:
                continue
            dt_ids = [d for d in network.dt_ids if network.dt_subdivision[d] == sub_id]
            if not dt_ids:
                continue
            gap_kw_series: dict[str, np.ndarray] = {}
            dt_limit_kw: dict[str, float] = {}
            dr_potential_kw: dict[str, float] = {}
            hub_potential_kw: dict[str, float] = {}
            storage_energy_kwh: dict[str, float] = {}
            shift_potential_kw: dict[str, float] = {}
            for dt_id in dt_ids:
                gross = self.scenario.dt_gross_kw[dt_id]
                available = self.scenario.dt_available_kw[dt_id]
                gap_kw_series[dt_id] = np.maximum(gross - available, 0.0)
                rated_kw = next(d.rated_kw for d in self.dt_statics if d.dt_id == dt_id)
                dt_limit_kw[dt_id] = rated_kw
                dr_potential_kw[dt_id] = 0.10 * rated_kw
                hub_potential_kw[dt_id] = 0.05 * rated_kw
                storage_energy_kwh[dt_id] = 0.0
                shift_potential_kw[dt_id] = 0.05 * rated_kw
            self.plan_service.refresh_from_series(
                subdivision_id=sub_id,
                dt_ids=dt_ids,
                gap_kw_series=gap_kw_series,
                dt_limit_kw=dt_limit_kw,
                dr_potential_kw=dr_potential_kw,
                hub_potential_kw=hub_potential_kw,
                storage_energy_kwh=storage_energy_kwh,
                shift_potential_kw=shift_potential_kw,
            )

    def drain_interval_results(self) -> list[tuple]:
        """Pop and return every raw (solution, shadow) ``IntervalResult`` pair
        produced since the last drain (used by the SSE ``tick`` event to build
        per-DT telemetry; see ``services/stream.py``).
        """
        out = self._pending_interval_results
        self._pending_interval_results = []
        return out

    def drain_risk_transitions(self) -> list[dict[str, str]]:
        """Return every DT whose risk bucket (``RiskLevel``) changed since the
        last call, for the SSE ``risk`` event's ``{dtId, subdivisionId, from,
        to, reason}`` contract (``frontend/src/lib/live/types.ts``'s
        ``RiskStreamPayload``) -- a level *transition*, not the full ranking
        ``risk_summary()`` reports for the REST API.
        """
        if not self.solution_logs:
            return []
        transitions: list[dict[str, str]] = []
        for static in self.dt_statics:
            hotspot = self.world.solution.cumulative_loss_of_life_hours.get(static.dt_id, 0.0)
            risk = compute_dt_risk(
                dt_id=static.dt_id,
                hot_spot_c=30.0 + hotspot,
                forecast_gap_kw=0.0,
                dt_limit_kw=static.rated_kw,
                ageing_factor=1.0,
            )
            level = risk.level.value
            prev = self._prev_risk_levels.get(static.dt_id)
            if prev is not None and prev != level:
                transitions.append(
                    {
                        "dtId": static.dt_id,
                        "subdivisionId": static.subdivision_id,
                        "from": prev,
                        "to": level,
                        "reason": f"risk score {risk.score:.2f}",
                    }
                )
            self._prev_risk_levels[static.dt_id] = level
        return transitions

    def _to_log_row(self, slot: int, result, is_shadow: bool) -> LogRow:  # type: ignore[no-untyped-def]
        gross = sum(result.dt_demand_kw.values())
        served = sum(result.dt_served_kw.values())
        unserved = sum(result.dt_unserved_kw.values())
        overload_count = sum(1 for v in result.dt_loading_pu.values() if v > 1.0)
        hotspot_max = max(result.dt_hotspot_c.values()) if result.dt_hotspot_c else 0.0
        voltage_min = min(result.dt_voltage_pu.values()) if result.dt_voltage_pu else 1.0
        return LogRow(
            slot=slot,
            timestamp=datetime.now(UTC),
            subdivision_id="all",
            gross_kw=gross,
            net_kw=gross,
            available_kw=served + unserved,
            served_kw=served,
            unserved_kw=unserved,
            overload_dt_count=overload_count,
            hotspot_max_c=hotspot_max,
            voltage_min_pu=voltage_min,
            is_shadow=is_shadow,
        )

    def tick(self, real_dt_seconds: float = 1.0) -> list[tuple[LogRow, LogRow]]:
        """Advance the sim clock by ``time_scale * real_dt_seconds`` sim-seconds,
        firing ``advance_one_interval`` for every 15-minute boundary crossed.
        """
        self.state.sim_seconds_accumulated += self.time_scale * real_dt_seconds
        interval_seconds = INTERVAL_MIN * 60
        fired: list[tuple[LogRow, LogRow]] = []
        while self.state.sim_seconds_accumulated >= interval_seconds:
            self.state.sim_seconds_accumulated -= interval_seconds
            fired.append(self.advance_one_interval())
        return fired

    def jump(self, n_intervals: int) -> None:
        """Advance the simulation by ``n_intervals`` directly (demo scrubbing),
        bypassing the real-time accumulator.
        """
        for _ in range(max(n_intervals, 0)):
            self.advance_one_interval()

    def set_autopilot(self, enabled: bool) -> None:
        self.state.autopilot_enabled = enabled

    # -- read -------------------------------------------------------------

    def kpis(self) -> dict[str, float | int]:
        sol_unserved = np.array([r.unserved_kw for r in self.solution_logs])
        shadow_unserved = np.array([r.unserved_kw for r in self.shadow_logs])
        sol_served = np.array([r.served_kw for r in self.solution_logs])
        served_by_dt = list(self.world.solution.cumulative_loss_of_life_hours.values())
        fairness = jain_index(np.array(served_by_dt)) if served_by_dt else 1.0

        return {
            "slot": self.state.slot,
            "n_intervals_simulated": len(self.solution_logs),
            "solution_hours_of_hardship": hours_of_hardship(sol_unserved)
            if len(sol_unserved)
            else 0.0,
            "shadow_hours_of_hardship": hours_of_hardship(shadow_unserved)
            if len(shadow_unserved)
            else 0.0,
            "solution_lifeline_availability": lifeline_availability(sol_served * 1000.0)
            if len(sol_served)
            else 1.0,
            "fairness_jain_index": fairness,
            "active_plans": len(
                [p for p in self.plan_service.list_plans() if p.status == PlanStatus.DRAFT]
            ),
        }

    def risk_summary(self) -> list[dict]:
        if not self.solution_logs:
            return []
        latest_slot = self.state.slot - 1
        if latest_slot < 0:
            return []
        risks = []
        for static in self.dt_statics:
            hotspot = self.world.solution.cumulative_loss_of_life_hours.get(static.dt_id, 0.0)
            risk = compute_dt_risk(
                dt_id=static.dt_id,
                hot_spot_c=30.0 + hotspot,
                forecast_gap_kw=0.0,
                dt_limit_kw=static.rated_kw,
                ageing_factor=1.0,
            )
            risks.append(risk)
        ranked = rank_by_risk(risks)
        return [{"dt_id": r.dt_id, "score": r.score, "level": r.level.value} for r in ranked]

    def live_kpis(self) -> dict[str, float | int | str]:
        """Aggregate KPIs for the SSE ``kpis`` event's ``KpisStreamPayload``
        contract (``frontend/src/lib/live/types.ts``) -- deliberately a much
        smaller shape than ``kpis()`` (which backs the REST aggregates view).
        """
        if self.solution_logs:
            last = self.solution_logs[-1]
            served_fraction = last.served_kw / last.gross_kw if last.gross_kw > 0 else 1.0
        else:
            served_fraction = 1.0
        active_plan_count = len(
            [
                p
                for p in self.plan_service.list_plans()
                if p.status in (PlanStatus.DRAFT, PlanStatus.APPROVED, PlanStatus.DISPATCHED)
            ]
        )
        dt_at_risk_count = sum(
            1 for r in self.risk_summary() if r["level"] in ("high", "critical")
        )
        return {
            "subdivisionId": "all",
            "servedFraction": served_fraction,
            "activePlanCount": active_plan_count,
            "dtAtRiskCount": dt_at_risk_count,
        }


__all__ = [
    "GridService",
    "GridServiceState",
    "ScenarioData",
    "build_scenario",
    "actions_from_plan_solution",
]
