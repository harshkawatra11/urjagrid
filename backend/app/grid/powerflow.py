"""Backward/forward sweep LV power-flow solver for a radial (tree) network.

Single-phase, balanced-3-phase-equivalent model: every bus carries a
constant-power load (P + jQ, consuming convention), every branch a series
impedance (R + jX), and bus 0 is the slack (fixed voltage, e.g. the DT's LV
secondary). The backward/forward sweep (BFS) algorithm is standard for
radial distribution feeders: sweep current demand up to the root (backward),
then sweep updated voltages back down to the leaves (forward), iterating to
convergence. Verified in tests against the closed-form two-bus solution.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Branch:
    parent: str
    child: str
    r_ohm: float
    x_ohm: float


@dataclass
class LVNetwork:
    """A radial LV network: one slack bus (``root``) feeding a tree of buses."""

    root: str
    branches: list[Branch] = field(default_factory=list)
    load_kw: dict[str, float] = field(default_factory=dict)
    load_kvar: dict[str, float] = field(default_factory=dict)

    def bus_ids(self) -> list[str]:
        ids = {self.root}
        for b in self.branches:
            ids.add(b.parent)
            ids.add(b.child)
        return sorted(ids)

    def children_of(self, bus_id: str) -> list[Branch]:
        return [b for b in self.branches if b.parent == bus_id]

    def parent_branch_of(self, bus_id: str) -> Branch | None:
        for b in self.branches:
            if b.child == bus_id:
                return b
        return None


@dataclass
class PowerFlowResult:
    voltage: dict[str, complex]
    branch_current: dict[tuple[str, str], complex]
    iterations: int
    converged: bool

    def voltage_magnitude(self, bus_id: str) -> float:
        return abs(self.voltage[bus_id])


def _subtree_buses(network: LVNetwork, bus_id: str) -> list[str]:
    result = [bus_id]
    for branch in network.children_of(bus_id):
        result.extend(_subtree_buses(network, branch.child))
    return result


def _injected_current(bus_id: str, v: complex, load_kw: float, load_kvar: float) -> complex:
    """Constant-power load injected current: S = V * conj(I) => I = conj(S/V)."""
    s_va = complex(load_kw, load_kvar) * 1000.0
    if abs(v) < 1e-9:
        return 0j
    return (s_va / v).conjugate()


def solve_power_flow(
    network: LVNetwork,
    v_slack: complex,
    tol: float = 1e-6,
    max_iter: int = 100,
) -> PowerFlowResult:
    """Solve ``network`` via backward/forward sweep given the slack (DT secondary) voltage."""
    bus_ids = network.bus_ids()
    voltage: dict[str, complex] = {b: v_slack for b in bus_ids}
    voltage[network.root] = v_slack

    converged = False
    iterations = 0
    branch_current: dict[tuple[str, str], complex] = {}

    for iterations in range(1, max_iter + 1):
        # Backward sweep: branch current = sum of injected currents in its subtree.
        injected = {
            b: _injected_current(b, voltage[b], network.load_kw.get(b, 0.0), network.load_kvar.get(b, 0.0))
            for b in bus_ids
        }
        branch_current = {}
        for branch in network.branches:
            subtree = _subtree_buses(network, branch.child)
            branch_current[(branch.parent, branch.child)] = sum(
                injected[b] for b in subtree
            )

        # Forward sweep: propagate voltage drops from root outward (BFS order).
        new_voltage = dict(voltage)
        new_voltage[network.root] = v_slack
        frontier = [network.root]
        while frontier:
            next_frontier = []
            for parent in frontier:
                for branch in network.children_of(parent):
                    z = complex(branch.r_ohm, branch.x_ohm)
                    i_branch = branch_current[(branch.parent, branch.child)]
                    new_voltage[branch.child] = new_voltage[parent] - i_branch * z
                    next_frontier.append(branch.child)
            frontier = next_frontier

        max_delta = max(abs(new_voltage[b] - voltage[b]) for b in bus_ids)
        voltage = new_voltage
        if max_delta < tol:
            converged = True
            break

    return PowerFlowResult(
        voltage=voltage, branch_current=branch_current, iterations=iterations, converged=converged
    )
