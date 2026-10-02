"""Train the P10/P50/P90 LightGBM quantile demand forecaster and compute its
split-conformal calibration offset, writing artifacts to backend/data/models/.

Training data is generated entirely offline/synthetically: for a grid of
seeded weather days (across the four builtin scenario "kinds" plus random
variation) crossed with a sample of real DTs from the seed network, each
DT-day's demand curve is built from ``LoadModel`` + the DT's consumer mix,
then turned into (features, target_pu) rows by ``DayBuilder``. This stands
in for the real smart-meter history LifelineGrid would train on in
production.

Run with: py -3.12 backend/scripts/train_forecaster.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.grid.daydata import DayBuilder  # noqa: E402
from app.grid.forecaster import MODELS_DIR, split_conformal_offset  # noqa: E402
from app.grid.loadgen import ARCHETYPE_SHAPES, LoadModel  # noqa: E402
from app.grid.network import get_network_data  # noqa: E402
from app.grid.weather import synthetic_series  # noqa: E402

N_TRAIN_DAYS = 90
N_CAL_DAYS = 30
ARCHETYPES = list(ARCHETYPE_SHAPES.keys())


def build_dt_demand(dt_id: str, n_consumers: int, weather, load_model: LoadModel, rng: np.random.Generator) -> np.ndarray:
    n_sample = min(n_consumers, 150)
    mix = rng.choice(ARCHETYPES, size=max(n_sample, 1))
    total = np.zeros(96)
    for archetype in mix:
        total += load_model.consumer_demand_kw(str(archetype), weather.temp_c)
    scale = n_consumers / max(len(mix), 1)
    return total * scale


def generate_dataset(n_days: int, seed_offset: int) -> tuple[np.ndarray, np.ndarray]:
    data = get_network_data()
    rng = np.random.default_rng(1000 + seed_offset)
    builder = DayBuilder()

    counts: dict[str, int] = {}
    for dt_id in data.dt_ids:
        counts[dt_id] = sum(1 for d in data.consumer_dt.values() if d == dt_id) or 100

    dt_sample = list(rng.choice(data.dt_ids, size=min(len(data.dt_ids), 24), replace=False))

    feature_rows: list[np.ndarray] = []
    target_rows: list[np.ndarray] = []

    for day_idx in range(n_days):
        weather_seed = 5000 + seed_offset * 10_000 + day_idx
        t_min = float(rng.uniform(20, 28))
        t_max = float(rng.uniform(30, 46))
        cloud = float(rng.uniform(0.3, 1.0))
        weather = synthetic_series(seed=weather_seed, t_min=t_min, t_max=t_max, cloud_factor=cloud)
        load_model = LoadModel(seed=weather_seed)
        day_of_week = day_idx % 7
        month = (day_idx // 30) % 12 + 1

        for dt_id in dt_sample:
            demand_kw = build_dt_demand(dt_id, counts[dt_id], weather, load_model, rng)
            day_features = builder.build(
                demand_kw=demand_kw,
                temp_c=weather.temp_c,
                humidity_pct=weather.humidity_pct,
                solar_cf=weather.solar_cf,
                wind_cf=weather.wind_cf,
                dt_rating_kva=data.dt_rating_kva[dt_id],
                day_of_week=day_of_week,
                month_of_year=month,
            )
            feature_rows.append(day_features.features)
            target_rows.append(day_features.target_pu)

    x = np.vstack(feature_rows)
    y = np.concatenate(target_rows)
    return x, y


def main() -> None:
    import lightgbm as lgb

    print("Generating training set...")
    x_train, y_train = generate_dataset(N_TRAIN_DAYS, seed_offset=1)
    print(f"  {x_train.shape[0]} rows")

    print("Generating calibration (held-out) set...")
    x_cal, y_cal = generate_dataset(N_CAL_DAYS, seed_offset=2)
    print(f"  {x_cal.shape[0]} rows")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    quantiles = {"p10": 0.10, "p50": 0.50, "p90": 0.90}
    raw_cal_preds: dict[str, np.ndarray] = {}

    for name, alpha in quantiles.items():
        print(f"Training {name} (alpha={alpha})...")
        train_set = lgb.Dataset(x_train, label=y_train)
        params = {
            "objective": "quantile",
            "alpha": alpha,
            "learning_rate": 0.08,
            "num_leaves": 15,
            "min_data_in_leaf": 20,
            "verbose": -1,
            "seed": 42,
        }
        booster = lgb.train(params, train_set, num_boost_round=120)
        booster.save_model(str(MODELS_DIR / f"{name}.txt"))
        raw_cal_preds[name] = booster.predict(x_cal)

    offset = split_conformal_offset(y_cal, raw_cal_preds["p10"], raw_cal_preds["p90"], target_coverage=0.80)
    (MODELS_DIR / "conformal.json").write_text(json.dumps({"offset_pu": offset}))
    print(f"Split-conformal offset: {offset:.4f} pu")

    p10_cal = raw_cal_preds["p10"] - offset
    p90_cal = raw_cal_preds["p90"] + offset
    coverage = float(np.mean((y_cal >= p10_cal) & (y_cal <= p90_cal)))
    print(f"Calibrated coverage on held-out set: {coverage:.3f} (target 0.80)")


if __name__ == "__main__":
    main()
