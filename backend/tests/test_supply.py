import numpy as np

from app.grid.constants import SUBDIVISION_IDS
from app.grid.supply import (
    FIRM_SHARE_BY_KIND,
    SUBDIVISION_KIND,
    all_subdivisions_have_calibration,
    evening_indicator,
    firm_share_for_subdivision,
    supply_fraction,
    supply_fraction_for_subdivision,
)


def test_all_subdivisions_calibrated() -> None:
    assert all_subdivisions_have_calibration()
    for sd in SUBDIVISION_IDS:
        assert sd in SUBDIVISION_KIND


def test_firm_share_rank_order_urban_gt_semi_gt_rural() -> None:
    assert FIRM_SHARE_BY_KIND["urban"] > FIRM_SHARE_BY_KIND["semi_urban"] > FIRM_SHARE_BY_KIND["rural"]


def test_evening_indicator_window() -> None:
    ind = evening_indicator()
    hours = np.arange(96) / 4.0
    assert np.all(ind[(hours >= 18) & (hours < 22)] == 1.0)
    assert np.all(ind[(hours < 18) | (hours >= 22)] == 0.0)


def test_supply_fraction_formula_matches_spec() -> None:
    firm = 0.7
    re_share = 0.2
    solar_cf = np.array([0.0, 0.5, 1.0])
    wind_cf = np.array([0.3, 0.3, 0.3])
    grid_storage = 0.1
    evening = np.array([0.0, 1.0, 0.0])

    result = supply_fraction(firm, re_share, solar_cf, wind_cf, grid_storage, evening)
    expected = np.minimum(1.0, firm + re_share * (0.6 * solar_cf + 0.4 * wind_cf) / 0.45 + grid_storage * evening)
    assert np.allclose(result, expected)


def test_supply_fraction_capped_at_one() -> None:
    result = supply_fraction(
        firm=0.95, re_share=0.9, solar_cf=np.array([1.0]), wind_cf=np.array([1.0]),
        grid_storage=0.5, evening=np.array([1.0]),
    )
    assert result[0] == 1.0


def test_supply_fraction_for_subdivision_uses_calibrated_firm() -> None:
    solar_cf = np.full(96, 0.5)
    wind_cf = np.full(96, 0.3)
    urban = supply_fraction_for_subdivision("sd_subhashnagar", 0.15, solar_cf, wind_cf, 0.05)
    rural = supply_fraction_for_subdivision("sd_kosikalan", 0.15, solar_cf, wind_cf, 0.05)
    assert urban.mean() > rural.mean()


def test_firm_share_for_subdivision() -> None:
    assert firm_share_for_subdivision("sd_subhashnagar") == FIRM_SHARE_BY_KIND["urban"]
    assert firm_share_for_subdivision("sd_kosikalan") == FIRM_SHARE_BY_KIND["rural"]
