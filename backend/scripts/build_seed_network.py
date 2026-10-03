"""Build backend/data/network/seed_network.json -- the real UrjaGrid network.

Uttar Pradesh, 2 DISCOMs (MVVNL Bareilly, DVVNL Mathura), 5 sub-divisions,
12 feeders, 48 DTs, ~7000 consumers.

Geocoding: attempts to resolve each sub-division's real locality name via
Nominatim (OpenStreetMap), one request per second per Nominatim's usage
policy, with a short descriptive User-Agent. If Nominatim is unreachable,
times out, or returns no match, falls back to a hard-coded approximate
coordinate for that locality (``SUBDIVISION_LOCALITY_FALLBACK`` in
``app/grid/network.py``) -- this keeps the build fully offline-capable.

Run with: py -3.12 backend/scripts/build_seed_network.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.grid.constants import SUBDIVISION_DISCOM, SUBDIVISION_IDS  # noqa: E402
from app.grid.network import (  # noqa: E402
    ARCHETYPES,
    SUBDIVISION_LOCALITY_FALLBACK,
    SUBDIVISION_SHORT_CODE,
    TIER_WEIGHTS,
)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "UrjaGrid-Hackathon-SeedBuilder/1.0 (contact: hackathon-demo@example.com)"

LOCALITY_QUERY = {
    "sd_subhashnagar": "Subhash Nagar, Bareilly, Uttar Pradesh, India",
    "sd_izzatnagar": "Izzatnagar, Bareilly, Uttar Pradesh, India",
    "sd_faridpur": "Faridpur, Bareilly, Uttar Pradesh, India",
    "sd_krishnanagar": "Krishna Nagar, Mathura, Uttar Pradesh, India",
    "sd_kosikalan": "Kosi Kalan, Mathura, Uttar Pradesh, India",
}

# feeders / DTs per sub-division, summing to 12 feeders / 48 DTs exactly.
FEEDERS_PER_SUB = {
    "sd_subhashnagar": 3,
    "sd_izzatnagar": 2,
    "sd_faridpur": 2,
    "sd_krishnanagar": 3,
    "sd_kosikalan": 2,
}
DTS_PER_SUB = {
    "sd_subhashnagar": 12,
    "sd_izzatnagar": 8,
    "sd_faridpur": 8,
    "sd_krishnanagar": 12,
    "sd_kosikalan": 8,
}

TARGET_CONSUMERS = 7000


def geocode(name: str, query: str) -> tuple[float, float, str]:
    """Return (lat, lon, source) for a locality, trying Nominatim first."""
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=8.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            lat = float(results[0]["lat"])
            lon = float(results[0]["lon"])
            return lat, lon, "nominatim"
    except Exception as exc:  # noqa: BLE001 -- any network failure falls back
        print(f"  [geocode] {name}: Nominatim failed ({exc!r}), using fallback coordinate")
    fallback = SUBDIVISION_LOCALITY_FALLBACK[name]
    return fallback[0], fallback[1], "fallback"


def main() -> None:
    rng = np.random.default_rng(20261002)

    print("Geocoding sub-division localities...")
    sub_coords: dict[str, tuple[float, float]] = {}
    sub_sources: dict[str, str] = {}
    for i, sub in enumerate(SUBDIVISION_IDS):
        lat, lon, source = geocode(sub, LOCALITY_QUERY[sub])
        sub_coords[sub] = (lat, lon)
        sub_sources[sub] = source
        print(f"  {sub}: ({lat:.4f}, {lon:.4f}) via {source}")
        if i < len(SUBDIVISION_IDS) - 1 and source == "nominatim":
            time.sleep(1.0)  # Nominatim usage policy: max 1 req/sec

    feeder_ids: list[str] = []
    feeder_subdivision: dict[str, str] = {}
    dt_ids: list[str] = []
    dt_feeder: dict[str, str] = {}
    dt_subdivision: dict[str, str] = {}
    dt_rating_kva: dict[str, float] = {}
    dt_lat: dict[str, float] = {}
    dt_lon: dict[str, float] = {}

    consumer_ids: list[str] = []
    consumer_dt: dict[str, str] = {}
    consumer_tier: dict[str, str] = {}
    consumer_archetype: dict[str, str] = {}
    consumer_lat: dict[str, float] = {}
    consumer_lon: dict[str, float] = {}

    letters = "abcdefghijklmnopqrstuvwxyz"
    tiers = list(TIER_WEIGHTS.keys())
    probs = np.array(list(TIER_WEIGHTS.values()))
    probs = probs / probs.sum()

    total_dts = sum(DTS_PER_SUB.values())

    for sub in SUBDIVISION_IDS:
        code = SUBDIVISION_SHORT_CODE[sub]
        base_lat, base_lon = sub_coords[sub]
        n_feeders = FEEDERS_PER_SUB[sub]
        n_dts = DTS_PER_SUB[sub]
        dts_per_feeder = [n_dts // n_feeders] * n_feeders
        for i in range(n_dts % n_feeders):
            dts_per_feeder[i] += 1

        dt_counter = 0
        for f_idx in range(n_feeders):
            fdr_id = f"fdr_{code}_{letters[f_idx]}"
            feeder_ids.append(fdr_id)
            feeder_subdivision[fdr_id] = sub
            for _ in range(dts_per_feeder[f_idx]):
                dt_counter += 1
                dt_id = f"dt_{code}_{dt_counter:02d}"
                dt_ids.append(dt_id)
                dt_feeder[dt_id] = fdr_id
                dt_subdivision[dt_id] = sub
                dt_rating_kva[dt_id] = float(rng.choice([100.0, 160.0, 250.0, 315.0]))
                jitter = rng.normal(0, 0.015, size=2)
                lat = base_lat + jitter[0]
                lon = base_lon + jitter[1]
                dt_lat[dt_id] = lat
                dt_lon[dt_id] = lon

                target_consumers_this_dt = round(TARGET_CONSUMERS * (n_dts / total_dts) / n_dts)
                n_consumers = max(
                    80,
                    int(rng.integers(target_consumers_this_dt - 20, target_consumers_this_dt + 21)),
                )
                for c_idx in range(1, n_consumers + 1):
                    c_id = f"c_{code}_{dt_counter:02d}_{c_idx:04d}"
                    consumer_ids.append(c_id)
                    consumer_dt[c_id] = dt_id
                    consumer_tier[c_id] = str(rng.choice(tiers, p=probs))
                    consumer_archetype[c_id] = str(rng.choice(ARCHETYPES))
                    c_jitter = rng.normal(0, 0.004, size=2)
                    consumer_lat[c_id] = lat + c_jitter[0]
                    consumer_lon[c_id] = lon + c_jitter[1]

    payload = {
        "subdivision_ids": list(SUBDIVISION_IDS),
        "discom_by_subdivision": SUBDIVISION_DISCOM,
        "geocode_sources": sub_sources,
        "feeder_ids": feeder_ids,
        "feeder_subdivision": feeder_subdivision,
        "dt_ids": dt_ids,
        "dt_feeder": dt_feeder,
        "dt_subdivision": dt_subdivision,
        "dt_rating_kva": dt_rating_kva,
        "dt_lat": dt_lat,
        "dt_lon": dt_lon,
        "consumer_ids": consumer_ids,
        "consumer_dt": consumer_dt,
        "consumer_tier": consumer_tier,
        "consumer_archetype": consumer_archetype,
        "consumer_lat": consumer_lat,
        "consumer_lon": consumer_lon,
    }

    out_path = Path(__file__).resolve().parents[1] / "data" / "network" / "seed_network.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload), encoding="utf-8")

    print(f"\nWrote {out_path}")
    print(f"  feeders={len(feeder_ids)} dts={len(dt_ids)} consumers={len(consumer_ids)}")


if __name__ == "__main__":
    main()
