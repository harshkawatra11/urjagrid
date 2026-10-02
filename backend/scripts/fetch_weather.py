"""Fetch real Open-Meteo historical archive data for 3 of the 4 builtin
weather scenarios (heatwave_evening, monsoon_cloud, solar_noon) and write
them to backend/data/weather/<name>.json in the Scenario wire shape.

``re_2047`` is intentionally excluded: it depicts a hypothetical 2047
renewable-heavy grid day, so no historical archive data can represent it --
``app/grid/weather.py`` builds it synthetically instead.

Run with: py -3.12 backend/scripts/fetch_weather.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.grid.constants import SLOTS_PER_DAY  # noqa: E402
from app.grid.network import SUBDIVISION_LOCALITY_FALLBACK  # noqa: E402

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "weather"

# (scenario name, label, town/locality lat-lon source, historical date, hourly->96-slot)
SCENARIOS = {
    "heatwave_evening": dict(
        label="Heatwave evening peak",
        town="Bareilly",
        lat=SUBDIVISION_LOCALITY_FALLBACK["sd_subhashnagar"][0],
        lon=SUBDIVISION_LOCALITY_FALLBACK["sd_subhashnagar"][1],
        date="2024-05-28",  # known pre-monsoon heatwave period in UP
    ),
    "monsoon_cloud": dict(
        label="Monsoon cloud cover",
        town="Mathura",
        lat=SUBDIVISION_LOCALITY_FALLBACK["sd_krishnanagar"][0],
        lon=SUBDIVISION_LOCALITY_FALLBACK["sd_krishnanagar"][1],
        date="2024-07-15",  # monsoon peak
    ),
    "solar_noon": dict(
        label="Clear solar noon",
        town="Bareilly",
        lat=SUBDIVISION_LOCALITY_FALLBACK["sd_izzatnagar"][0],
        lon=SUBDIVISION_LOCALITY_FALLBACK["sd_izzatnagar"][1],
        date="2024-10-10",  # clear post-monsoon day
    ),
}


def hourly_to_96_slots(values: list[float]) -> list[float]:
    """Linear-interpolate 24 hourly values to 96 15-min slots."""
    hourly = np.array(values, dtype=float)
    if len(hourly) < 24:
        hourly = np.pad(hourly, (0, 24 - len(hourly)), mode="edge")
    hour_grid = np.arange(24)
    slot_hours = np.arange(SLOTS_PER_DAY) / 4.0
    # wrap for interpolation at the day boundary
    hour_grid_ext = np.concatenate([hour_grid, [24.0]])
    hourly_ext = np.concatenate([hourly, [hourly[0]]])
    return list(np.interp(slot_hours, hour_grid_ext, hourly_ext))


def fetch_one(name: str, cfg: dict) -> dict | None:
    try:
        resp = httpx.get(
            ARCHIVE_URL,
            params={
                "latitude": cfg["lat"],
                "longitude": cfg["lon"],
                "start_date": cfg["date"],
                "end_date": cfg["date"],
                "hourly": "temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m",
                "timezone": "Asia/Kolkata",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        hourly = data["hourly"]
    except Exception as exc:  # noqa: BLE001
        print(f"  [{name}] Open-Meteo fetch failed ({exc!r}); leaving to synthetic fallback")
        return None

    temp_c = hourly_to_96_slots(hourly["temperature_2m"])
    humidity_pct = hourly_to_96_slots(hourly["relative_humidity_2m"])
    radiation = np.array(hourly_to_96_slots(hourly["shortwave_radiation"]))
    solar_cf = list(np.clip(radiation / 1000.0, 0.0, 1.0))  # ~1000 W/m^2 peak -> cf=1.0
    wind_speed = np.array(hourly_to_96_slots(hourly["wind_speed_10m"]))
    wind_cf = list(np.clip(wind_speed / 12.0, 0.0, 1.0))  # ~12 m/s -> cf=1.0

    return {
        "name": name,
        "label": cfg["label"],
        "town": cfg["town"],
        "source": "open_meteo_archive",
        "temp_c": temp_c,
        "solar_cf": solar_cf,
        "wind_cf": wind_cf,
        "humidity_pct": humidity_pct,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, cfg in SCENARIOS.items():
        print(f"Fetching {name} ({cfg['town']}, {cfg['date']})...")
        payload = fetch_one(name, cfg)
        if payload is None:
            continue
        out_path = OUT_DIR / f"{name}.json"
        out_path.write_text(json.dumps(payload), encoding="utf-8")
        print(f"  wrote {out_path}")


if __name__ == "__main__":
    main()
