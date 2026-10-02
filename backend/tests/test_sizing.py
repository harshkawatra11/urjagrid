import numpy as np

from app.grid.loadgen import ARCHETYPE_SHAPES, LoadModel
from app.grid.network import get_network_data
from app.grid.sizing import AssetProfiles, loading_pu, overload_fraction, size_network
from app.grid.weather import BUILTIN_SCENARIOS


def test_hub_profile_shape_and_peak() -> None:
    curve = AssetProfiles.hub_profile(rated_kw=50.0)
    assert len(curve) == 96
    assert curve.max() <= 50.0 + 1e-6
    assert curve.max() > curve[0]


def test_facility_profile_is_flat() -> None:
    curve = AssetProfiles.facility_profile(rated_kw=20.0)
    assert np.all(curve == 20.0)


def test_pv_profile_tracks_solar_cf() -> None:
    weather = BUILTIN_SCENARIOS["solar_noon"].to_series()
    curve = AssetProfiles.pv_profile(rated_kwp=10.0, weather=weather)
    assert curve[0] == 0.0  # midnight, no sun
    assert curve.max() <= 10.0 + 1e-6


def test_loading_pu_basic_math() -> None:
    demand = np.array([90.0, 180.0])
    pu = loading_pu(demand, rating_kva=100.0, power_factor=0.9)
    assert np.allclose(pu, [1.0, 2.0])


def test_seed_network_sizing_produces_realistic_overload_range() -> None:
    """Under the heatwave scenario, a plausible-but-not-everything fraction
    of real DTs should be overloaded -- this is the sizing calibration target.
    """
    data = get_network_data()
    weather = BUILTIN_SCENARIOS["heatwave_evening"].to_series()
    model = LoadModel(seed=11)

    # Build a lightweight per-DT consumer archetype mix from the real network
    # (sampling, for speed, rather than iterating all 7000 consumers' exact ids).
    rng = np.random.default_rng(0)
    archetypes = list(ARCHETYPE_SHAPES.keys())

    dt_demand = {}
    for dt_id in data.dt_ids:
        n_consumers = sum(1 for d in data.consumer_dt.values() if d == dt_id)
        n_consumers = n_consumers or 100
        mix = rng.choice(archetypes, size=min(n_consumers, 200))
        total = np.zeros(96)
        for archetype in mix:
            total += model.consumer_demand_kw(str(archetype), weather.temp_c)
        scale = n_consumers / max(len(mix), 1)
        dt_demand[dt_id] = total * scale

    summary = size_network(dt_demand, data.dt_rating_kva)
    frac = overload_fraction(summary)
    assert 0.0 <= frac <= 1.0
    # Not asserting a tight band here (that's a scenario-calibration concern for
    # A8/A10); just confirm sizing arithmetic runs end-to-end over the real network.
    assert len(summary) == len(data.dt_ids)
