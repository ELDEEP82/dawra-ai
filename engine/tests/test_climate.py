"""Tests for climate.py — FAO-56 worked examples and helpers."""
import numpy as np
import pandas as pd
import pytest

from dawra import assumptions as A
from dawra import climate as c


def test_ra_fao56_example8():
    # FAO-56 Example 8: 20°S, 3 September (J=246) -> Ra = 32.2 MJ m-2 d-1
    assert c.extraterrestrial_rad(246, -20.0) == pytest.approx(32.2, abs=0.1)


def test_example18_brussels_et0():
    """FAO-56 Example 18: Brussels 6 July, ET0 = 3.9 mm/day."""
    lat, elev, doy = 50 + 48 / 60, 100.0, 187
    tmax, tmin, rhmax, rhmin = 21.5, 12.3, 84.0, 63.0
    u2 = 2.078
    n_hours = 9.25
    ea = (c.sat_vp(tmin) * rhmax / 100 + c.sat_vp(tmax) * rhmin / 100) / 2  # FAO-56 Eq.17
    assert ea == pytest.approx(1.409, abs=0.005)
    ra = c.extraterrestrial_rad(doy, lat)
    assert ra == pytest.approx(41.09, abs=0.1)
    big_n = c.daylight_hours(doy, lat)
    rs = (A.get("clim.ang_a") + A.get("clim.ang_b") * n_hours / big_n) * ra
    assert rs == pytest.approx(22.07, abs=0.1)
    et0 = float(c.et0_pm(tmax, tmin, rs, ea, u2, doy, lat, elev))
    assert et0 == pytest.approx(3.9, abs=0.1)


def test_psychrometric_constant():
    # FAO-56 Example 2: z = 1800 m -> gamma = 0.054 kPa/°C
    assert c.psychro(1800) == pytest.approx(0.054, abs=0.001)


def test_effective_rain_usda():
    assert c.effective_rain_monthly(np.array([0.0]))[0] == 0
    assert c.effective_rain_monthly(np.array([10.0]))[0] == pytest.approx(10 * (125 - 2) / 125)
    assert c.effective_rain_monthly(np.array([300.0]))[0] == pytest.approx(155.0)


def test_daily_peff_le_rain():
    idx = pd.date_range("2021-01-01", periods=59, freq="D")
    p = pd.Series(0.0, index=idx)
    p.iloc[[3, 40]] = [12.0, 5.0]
    pe = c.daily_peff(p)
    assert (pe <= p + 1e-9).all() and pe.sum() > 0


def test_heat_days():
    df = pd.DataFrame({"T2M_MAX": [30, 36, 41, 35]})
    assert c.heat_days(df, 35) == 2


def test_local_et0_annual_in_expected_range():
    from dawra.data_io import load_power
    df = c.add_derived(load_power())
    ann = c.annual_summary(df)
    assert ann["ET0_mm"].between(1700, 2100).all(), ann["ET0_mm"]
    assert ann["rain_mm"].lt(150).all()


def test_warming_raises_et0():
    from dawra.data_io import load_power
    df = load_power().iloc[:365]
    assert c.et0_fao56(df, d_t=2).sum() > c.et0_fao56(df).sum()
