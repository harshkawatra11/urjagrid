import numpy as np
import pytest

from app.grid.network import (
    ConsumerArrays,
    bounded_voronoi,
    get_network_data,
    synthetic_network,
)


def test_bounded_voronoi_returns_one_polygon_per_point() -> None:
    points = np.array([[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]])
    polygons = bounded_voronoi(points, (-1, 2, -1, 2))
    assert len(polygons) == 3
    for poly in polygons:
        assert poly.shape[1] == 2
        assert len(poly) >= 3


def test_bounded_voronoi_cells_cover_bounding_box_points_within() -> None:
    points = np.array([[0.2, 0.2], [0.8, 0.8]])
    box = (0.0, 1.0, 0.0, 1.0)
    polygons = bounded_voronoi(points, box)
    for poly in polygons:
        assert np.all(poly[:, 0] >= -1e-9)
        assert np.all(poly[:, 0] <= 1.0 + 1e-9)
        assert np.all(poly[:, 1] >= -1e-9)
        assert np.all(poly[:, 1] <= 1.0 + 1e-9)


def test_bounded_voronoi_single_point_is_whole_box() -> None:
    points = np.array([[0.5, 0.5]])
    polygons = bounded_voronoi(points, (0.0, 1.0, 0.0, 1.0))
    assert len(polygons) == 1
    assert len(polygons[0]) == 4


def test_bounded_voronoi_empty_input() -> None:
    assert bounded_voronoi(np.empty((0, 2)), (0, 1, 0, 1)) == []


def test_synthetic_network_shape_and_id_conventions() -> None:
    net = synthetic_network(seed=7)
    assert len(net.subdivision_ids) == 2
    assert all(f.startswith("fdr_") for f in net.feeder_ids)
    assert all(d.startswith("dt_") for d in net.dt_ids)
    assert isinstance(net.consumers, ConsumerArrays)
    for c_id in net.consumers.consumer_ids[:5]:
        assert c_id.startswith("c_")
        parts = c_id.split("_")
        assert len(parts) == 4

    for dt_id in net.consumers.dt_ids:
        assert dt_id in net.dt_ids


def test_synthetic_network_is_deterministic() -> None:
    net_a = synthetic_network(seed=99)
    net_b = synthetic_network(seed=99)
    assert net_a.dt_ids == net_b.dt_ids
    assert list(net_a.consumers.consumer_ids) == list(net_b.consumers.consumer_ids)
    assert np.allclose(net_a.consumers.lat, net_b.consumers.lat)


def test_synthetic_network_different_seeds_differ() -> None:
    net_a = synthetic_network(seed=1)
    net_b = synthetic_network(seed=2)
    assert not np.allclose(net_a.consumers.lat, net_b.consumers.lat)


def test_get_network_data_loads_real_seed_network() -> None:
    data = get_network_data()
    assert len(data.feeder_ids) == 12
    assert len(data.dt_ids) == 48
    assert len(data.consumer_ids) == 7000
    assert set(data.subdivision_ids) == {
        "sd_subhashnagar",
        "sd_izzatnagar",
        "sd_faridpur",
        "sd_krishnanagar",
        "sd_kosikalan",
    }
    for dt_id in data.dt_ids:
        assert dt_id in data.dt_feeder
        assert dt_id in data.dt_subdivision
        assert dt_id in data.dt_rating_kva


def test_get_network_data_missing_file_raises() -> None:
    from pathlib import Path

    with pytest.raises(FileNotFoundError):
        get_network_data(Path("does_not_exist.json"))
