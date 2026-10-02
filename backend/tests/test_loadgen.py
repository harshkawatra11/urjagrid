import numpy as np

from app.grid.constants import SLOTS_PER_DAY
from app.grid.loadgen import ARCHETYPE_SHAPES, LoadModel
from app.grid.network import synthetic_network
from app.grid.weather import synthetic_series


def test_archetype_shapes_cover_all_archetypes_and_are_positive() -> None:
    for name, shape in ARCHETYPE_SHAPES.items():
        assert len(shape) == SLOTS_PER_DAY
        assert np.all(shape > 0)


def test_consumer_demand_kw_is_deterministic() -> None:
    weather = synthetic_series(seed=1)
    model_a = LoadModel(seed=10)
    model_b = LoadModel(seed=10)
    curve_a = model_a.consumer_demand_kw("cooler_ac", weather.temp_c)
    curve_b = model_b.consumer_demand_kw("cooler_ac", weather.temp_c)
    assert np.allclose(curve_a, curve_b)


def test_cooler_ac_demand_increases_with_temperature() -> None:
    model = LoadModel(seed=1)
    cool_day = np.full(SLOTS_PER_DAY, 25.0)
    hot_day = np.full(SLOTS_PER_DAY, 42.0)
    cool_curve = model.consumer_demand_kw("cooler_ac", cool_day)
    hot_curve = model.consumer_demand_kw("cooler_ac", hot_day)
    assert hot_curve.mean() > cool_curve.mean()


def test_generate_network_demand_aggregates_per_dt() -> None:
    net = synthetic_network(seed=3, consumers_per_dt=15)
    weather = synthetic_series(seed=4)
    model = LoadModel(seed=5)
    demand = model.generate_network_demand(net.consumers, weather)

    assert set(demand.keys()) == set(net.dt_ids)
    for dt_id, curve in demand.items():
        assert len(curve) == SLOTS_PER_DAY
        assert np.all(curve >= 0)
        n_consumers = int(np.sum(net.consumers.dt_ids == dt_id))
        assert curve.max() < n_consumers * 3.0  # sanity ceiling vs peak archetype kW
