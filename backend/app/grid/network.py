"""Grid network topology: Voronoi DT service areas, consumer arrays, and the
seed-network repository.

Real-world anchoring: the five sub-division localities (Subhash Nagar,
Izzatnagar, Faridpur in Bareilly/MVVNL; Krishna Nagar, Kosi Kalan in
Mathura/DVVNL) are geocoded via Nominatim by ``backend/scripts/build_seed_network.py``
with a hard-coded coordinate fallback (used automatically if Nominatim is
unreachable or returns no result) -- that script is run once, offline from
test runs, to produce the committed ``backend/data/network/seed_network.json``.
Everything in *this* module is pure/offline: it only ever reads that JSON
file (via ``NetworkRepository``) or builds a small synthetic network in
memory (``synthetic_network``) for tests. No network I/O happens here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np
from numpy.random import Generator, default_rng
from scipy.spatial import Voronoi

from app.grid.constants import SUBDIVISION_IDS

DEFAULT_SEED_NETWORK_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "network" / "seed_network.json"
)

# Real-world approximate locality anchors (used as the hard-coded fallback
# when live geocoding is unavailable; also used directly by `synthetic_network`).
SUBDIVISION_LOCALITY_FALLBACK: dict[str, tuple[float, float]] = {
    "sd_subhashnagar": (28.3670, 79.4304),  # Subhash Nagar, Bareilly
    "sd_izzatnagar": (28.3775, 79.4591),  # Izzatnagar, Bareilly
    "sd_faridpur": (28.2033, 79.5425),  # Faridpur, Bareilly district
    "sd_krishnanagar": (27.4833, 77.6897),  # Krishna Nagar, Mathura
    "sd_kosikalan": (27.6333, 77.4333),  # Kosi Kalan, Mathura district
}

SUBDIVISION_SHORT_CODE: dict[str, str] = {
    "sd_subhashnagar": "sn",
    "sd_izzatnagar": "iz",
    "sd_faridpur": "fp",
    "sd_krishnanagar": "kn",
    "sd_kosikalan": "kk",
}


# ---------------------------------------------------------------------------
# Voronoi
# ---------------------------------------------------------------------------


def bounded_voronoi(
    points: np.ndarray, bounding_box: tuple[float, float, float, float]
) -> list[np.ndarray]:
    """Compute Voronoi cells for ``points``, clipped to ``bounding_box``.

    ``bounding_box`` is ``(min_x, max_x, min_y, max_y)``. Returns one polygon
    (an ``(n, 2)`` array of vertices, in order) per input point, built by
    mirroring every point across all four bbox edges before running
    ``scipy.spatial.Voronoi`` -- the standard trick that keeps unbounded
    regions for edge/corner points finite -- then clipping each resulting
    region to the box with the Sutherland-Hodgman algorithm.
    """
    points = np.asarray(points, dtype=float)
    n = len(points)
    if n == 0:
        return []
    min_x, max_x, min_y, max_y = bounding_box

    mirrored = [points]
    mirrored.append(np.column_stack([2 * min_x - points[:, 0], points[:, 1]]))
    mirrored.append(np.column_stack([2 * max_x - points[:, 0], points[:, 1]]))
    mirrored.append(np.column_stack([points[:, 0], 2 * min_y - points[:, 1]]))
    mirrored.append(np.column_stack([points[:, 0], 2 * max_y - points[:, 1]]))
    all_points = np.vstack(mirrored)

    if n < 2:
        # A single point: its cell is simply the whole box.
        box = np.array(
            [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]], dtype=float
        )
        return [box]

    vor = Voronoi(all_points)

    polygons: list[np.ndarray] = []
    box = [(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)]
    for i in range(n):
        region_idx = vor.point_region[i]
        region = vor.regions[region_idx]
        if not region or -1 in region:
            # Shouldn't happen after mirroring, but fall back to the full box.
            polygons.append(np.array(box, dtype=float))
            continue
        verts = vor.vertices[region]
        clipped = _clip_polygon(verts, box)
        if len(clipped) == 0:
            clipped = np.array(box, dtype=float)
        polygons.append(clipped)
    return polygons


def _clip_polygon(subject: np.ndarray, clip_box: list[tuple[float, float]]) -> np.ndarray:
    """Sutherland-Hodgman polygon clipping against a convex (rectangular) box."""

    def inside(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> bool:
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0

    def intersect(
        p1: tuple[float, float],
        p2: tuple[float, float],
        a: tuple[float, float],
        b: tuple[float, float],
    ) -> tuple[float, float]:
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = a
        x4, y4 = b
        denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if denom == 0:
            return p2
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))

    output = [tuple(p) for p in subject]
    for i in range(len(clip_box)):
        a = clip_box[i]
        b = clip_box[(i + 1) % len(clip_box)]
        if not output:
            break
        input_list = output
        output = []
        for j in range(len(input_list)):
            cur = input_list[j]
            prev = input_list[j - 1]
            cur_in = inside(cur, a, b)
            prev_in = inside(prev, a, b)
            if cur_in:
                if not prev_in:
                    output.append(intersect(prev, cur, a, b))
                output.append(cur)
            elif prev_in:
                output.append(intersect(prev, cur, a, b))
    return np.array(output, dtype=float) if output else np.empty((0, 2))


# ---------------------------------------------------------------------------
# Consumer arrays
# ---------------------------------------------------------------------------


@dataclass
class ConsumerArrays:
    """Parallel numpy arrays describing every consumer in a network.

    Kept as plain numpy arrays (not a pydantic model) because this is an
    internal engine structure used for vectorised load-generation math, not
    a wire payload.
    """

    consumer_ids: np.ndarray  # dtype=object, str ids e.g. "c_sn_01_0007"
    dt_ids: np.ndarray  # dtype=object, parent DT id per consumer
    subdivision_ids: np.ndarray  # dtype=object
    tier: np.ndarray  # dtype=object, one of "t0","t1","t2","t3"
    archetype: np.ndarray  # dtype=object, load archetype label
    lat: np.ndarray
    lon: np.ndarray

    def __len__(self) -> int:
        return len(self.consumer_ids)


# ---------------------------------------------------------------------------
# Synthetic network for fast, offline, deterministic tests
# ---------------------------------------------------------------------------

TIER_WEIGHTS = {"t0": 0.01, "t1": 0.70, "t2": 0.20, "t3": 0.09}
ARCHETYPES = ("lighting_fan", "cooler_ac", "fridge_tv", "shop_small", "shop_cold_chain")


@dataclass
class SyntheticNetwork:
    subdivision_ids: list[str]
    feeder_ids: list[str]
    feeder_subdivision: dict[str, str]
    dt_ids: list[str]
    dt_feeder: dict[str, str]
    dt_subdivision: dict[str, str]
    dt_rating_kva: dict[str, float]
    dt_lat: dict[str, float]
    dt_lon: dict[str, float]
    consumers: ConsumerArrays


def synthetic_network(
    seed: int = 42,
    n_subdivisions: int = 2,
    feeders_per_subdivision: int = 2,
    dts_per_feeder: int = 2,
    consumers_per_dt: int = 20,
) -> SyntheticNetwork:
    """Build a small, fully in-memory network with the same id conventions
    and structure as the real seed network, for fast deterministic tests.
    """
    rng: Generator = default_rng(seed)
    sub_ids = list(SUBDIVISION_IDS[:n_subdivisions])

    feeder_ids: list[str] = []
    feeder_subdivision: dict[str, str] = {}
    dt_ids: list[str] = []
    dt_feeder: dict[str, str] = {}
    dt_subdivision: dict[str, str] = {}
    dt_rating_kva: dict[str, float] = {}
    dt_lat: dict[str, float] = {}
    dt_lon: dict[str, float] = {}

    consumer_ids: list[str] = []
    consumer_dt: list[str] = []
    consumer_sub: list[str] = []
    consumer_tier: list[str] = []
    consumer_archetype: list[str] = []
    consumer_lat: list[float] = []
    consumer_lon: list[float] = []

    letters = "abcdefghijklmnopqrstuvwxyz"
    dt_counter_per_sub: dict[str, int] = dict.fromkeys(sub_ids, 0)

    for sub in sub_ids:
        base_lat, base_lon = SUBDIVISION_LOCALITY_FALLBACK[sub]
        code = SUBDIVISION_SHORT_CODE[sub]
        for f_idx in range(feeders_per_subdivision):
            fdr_id = f"fdr_{code}_{letters[f_idx]}"
            feeder_ids.append(fdr_id)
            feeder_subdivision[fdr_id] = sub
            for _ in range(dts_per_feeder):
                dt_counter_per_sub[sub] += 1
                dt_num = dt_counter_per_sub[sub]
                dt_id = f"dt_{code}_{dt_num:02d}"
                dt_ids.append(dt_id)
                dt_feeder[dt_id] = fdr_id
                dt_subdivision[dt_id] = sub
                dt_rating_kva[dt_id] = float(rng.choice([100.0, 160.0, 250.0]))
                jitter = rng.normal(0, 0.01, size=2)
                lat = base_lat + jitter[0]
                lon = base_lon + jitter[1]
                dt_lat[dt_id] = lat
                dt_lon[dt_id] = lon

                tiers = list(TIER_WEIGHTS.keys())
                probs = np.array(list(TIER_WEIGHTS.values()))
                probs = probs / probs.sum()
                for c_idx in range(1, consumers_per_dt + 1):
                    c_id = f"c_{code}_{dt_num:02d}_{c_idx:04d}"
                    consumer_ids.append(c_id)
                    consumer_dt.append(dt_id)
                    consumer_sub.append(sub)
                    tier = str(rng.choice(tiers, p=probs))
                    consumer_tier.append(tier)
                    consumer_archetype.append(str(rng.choice(ARCHETYPES)))
                    c_jitter = rng.normal(0, 0.002, size=2)
                    consumer_lat.append(lat + c_jitter[0])
                    consumer_lon.append(lon + c_jitter[1])

    consumers = ConsumerArrays(
        consumer_ids=np.array(consumer_ids, dtype=object),
        dt_ids=np.array(consumer_dt, dtype=object),
        subdivision_ids=np.array(consumer_sub, dtype=object),
        tier=np.array(consumer_tier, dtype=object),
        archetype=np.array(consumer_archetype, dtype=object),
        lat=np.array(consumer_lat, dtype=float),
        lon=np.array(consumer_lon, dtype=float),
    )

    return SyntheticNetwork(
        subdivision_ids=sub_ids,
        feeder_ids=feeder_ids,
        feeder_subdivision=feeder_subdivision,
        dt_ids=dt_ids,
        dt_feeder=dt_feeder,
        dt_subdivision=dt_subdivision,
        dt_rating_kva=dt_rating_kva,
        dt_lat=dt_lat,
        dt_lon=dt_lon,
        consumers=consumers,
    )


# ---------------------------------------------------------------------------
# Seed network repository (real network, loaded from committed JSON)
# ---------------------------------------------------------------------------


@dataclass
class NetworkData:
    """Parsed contents of ``seed_network.json``."""

    subdivision_ids: list[str] = field(default_factory=list)
    discom_by_subdivision: dict[str, str] = field(default_factory=dict)
    feeder_ids: list[str] = field(default_factory=list)
    feeder_subdivision: dict[str, str] = field(default_factory=dict)
    dt_ids: list[str] = field(default_factory=list)
    dt_feeder: dict[str, str] = field(default_factory=dict)
    dt_subdivision: dict[str, str] = field(default_factory=dict)
    dt_rating_kva: dict[str, float] = field(default_factory=dict)
    dt_lat: dict[str, float] = field(default_factory=dict)
    dt_lon: dict[str, float] = field(default_factory=dict)
    consumer_ids: list[str] = field(default_factory=list)
    consumer_dt: dict[str, str] = field(default_factory=dict)
    consumer_tier: dict[str, str] = field(default_factory=dict)
    consumer_archetype: dict[str, str] = field(default_factory=dict)
    consumer_lat: dict[str, float] = field(default_factory=dict)
    consumer_lon: dict[str, float] = field(default_factory=dict)


class NetworkRepository:
    """Loads and caches the real seed network from disk.

    ``load`` is wrapped with ``lru_cache`` at the module level (see
    ``get_network_repository``) so repeated calls across the process are free.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or DEFAULT_SEED_NETWORK_PATH

    def load(self) -> NetworkData:
        import json

        if not self.path.exists():
            raise FileNotFoundError(
                f"seed network not found at {self.path}; "
                "run `py -3.12 backend/scripts/build_seed_network.py` first"
            )
        raw = json.loads(self.path.read_text(encoding="utf-8"))

        data = NetworkData(
            subdivision_ids=raw["subdivision_ids"],
            discom_by_subdivision=raw["discom_by_subdivision"],
            feeder_ids=raw["feeder_ids"],
            feeder_subdivision=raw["feeder_subdivision"],
            dt_ids=raw["dt_ids"],
            dt_feeder=raw["dt_feeder"],
            dt_subdivision=raw["dt_subdivision"],
            dt_rating_kva=raw["dt_rating_kva"],
            dt_lat=raw["dt_lat"],
            dt_lon=raw["dt_lon"],
            consumer_ids=raw["consumer_ids"],
            consumer_dt=raw["consumer_dt"],
            consumer_tier=raw["consumer_tier"],
            consumer_archetype=raw["consumer_archetype"],
            consumer_lat=raw["consumer_lat"],
            consumer_lon=raw["consumer_lon"],
        )
        return data


@lru_cache(maxsize=4)
def _load_cached(path_str: str) -> NetworkData:
    return NetworkRepository(Path(path_str)).load()


def get_network_data(path: Path | None = None) -> NetworkData:
    """lru-cached accessor for the real seed network (see ``NetworkRepository``)."""
    p = path or DEFAULT_SEED_NETWORK_PATH
    return _load_cached(str(p))
