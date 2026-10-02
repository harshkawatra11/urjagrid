import math

import pytest

from app.grid.powerflow import Branch, LVNetwork, solve_power_flow


def closed_form_two_bus_voltage(vs: float, r_ohm: float, x_ohm: float, p_w: float, q_var: float) -> float:
    """Closed-form receiving-end voltage magnitude for a single line + load.

    Standard quadratic-in-V^2 solution of the two-bus power-flow equations:
        Vr^4 + Vr^2*(2*(P*R + Q*X) - Vs^2) + (P^2 + Q^2)*(R^2 + X^2) = 0
    Takes the physically meaningful (near-Vs) root.
    """
    b = 2 * (p_w * r_ohm + q_var * x_ohm) - vs**2
    c = (p_w**2 + q_var**2) * (r_ohm**2 + x_ohm**2)
    disc = b**2 - 4 * c
    u1 = (-b + math.sqrt(disc)) / 2
    u2 = (-b - math.sqrt(disc)) / 2
    # pick the root nearer vs^2 (the stable, non-collapsed solution)
    u = u1 if abs(u1 - vs**2) < abs(u2 - vs**2) else u2
    return math.sqrt(u)


def test_two_bus_matches_closed_form_light_load() -> None:
    vs = 230.0
    r, x = 0.5, 0.2
    p_kw, q_kvar = 3.0, 1.0

    net = LVNetwork(
        root="b0",
        branches=[Branch(parent="b0", child="b1", r_ohm=r, x_ohm=x)],
        load_kw={"b1": p_kw},
        load_kvar={"b1": q_kvar},
    )
    result = solve_power_flow(net, v_slack=complex(vs, 0))
    assert result.converged

    expected_vr = closed_form_two_bus_voltage(vs, r, x, p_kw * 1000, q_kvar * 1000)
    assert result.voltage_magnitude("b1") == pytest.approx(expected_vr, rel=1e-4)


def test_two_bus_matches_closed_form_heavier_load() -> None:
    vs = 230.0
    r, x = 1.2, 0.5
    p_kw, q_kvar = 8.0, 2.5

    net = LVNetwork(
        root="b0",
        branches=[Branch(parent="b0", child="b1", r_ohm=r, x_ohm=x)],
        load_kw={"b1": p_kw},
        load_kvar={"b1": q_kvar},
    )
    result = solve_power_flow(net, v_slack=complex(vs, 0))
    assert result.converged

    expected_vr = closed_form_two_bus_voltage(vs, r, x, p_kw * 1000, q_kvar * 1000)
    assert result.voltage_magnitude("b1") == pytest.approx(expected_vr, rel=1e-4)


def test_zero_load_bus_has_slack_voltage() -> None:
    net = LVNetwork(
        root="b0",
        branches=[Branch(parent="b0", child="b1", r_ohm=1.0, x_ohm=0.3)],
        load_kw={"b1": 0.0},
        load_kvar={"b1": 0.0},
    )
    result = solve_power_flow(net, v_slack=complex(230.0, 0))
    assert result.voltage_magnitude("b1") == pytest.approx(230.0, abs=1e-6)


def test_radial_three_bus_chain_voltage_drops_monotonically() -> None:
    net = LVNetwork(
        root="b0",
        branches=[
            Branch(parent="b0", child="b1", r_ohm=0.4, x_ohm=0.15),
            Branch(parent="b1", child="b2", r_ohm=0.4, x_ohm=0.15),
        ],
        load_kw={"b1": 2.0, "b2": 2.0},
        load_kvar={"b1": 0.5, "b2": 0.5},
    )
    result = solve_power_flow(net, v_slack=complex(230.0, 0))
    v0 = result.voltage_magnitude("b0")
    v1 = result.voltage_magnitude("b1")
    v2 = result.voltage_magnitude("b2")
    assert v0 > v1 > v2


def test_branch_with_two_children_sums_currents() -> None:
    net = LVNetwork(
        root="b0",
        branches=[
            Branch(parent="b0", child="b1", r_ohm=0.5, x_ohm=0.2),
            Branch(parent="b0", child="b2", r_ohm=0.5, x_ohm=0.2),
        ],
        load_kw={"b1": 1.0, "b2": 1.0},
        load_kvar={"b1": 0.2, "b2": 0.2},
    )
    result = solve_power_flow(net, v_slack=complex(230.0, 0))
    assert result.converged
    assert result.voltage_magnitude("b1") == pytest.approx(result.voltage_magnitude("b2"), rel=1e-6)
