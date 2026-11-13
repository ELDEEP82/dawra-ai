"""Tests for M1 loaders (data_io)."""
from datetime import date

import numpy as np
import pandas as pd

from dawra import data_io as d


def test_power_loads_with_date_index():
    df = d.load_power()
    assert isinstance(df.index, pd.DatetimeIndex)
    assert df.index[0] == pd.Timestamp("2020-01-01")
    assert df.index[-1] == pd.Timestamp("2026-09-30")
    assert set(d.POWER_COLS) <= set(df.columns)
    assert (df["T2M_MAX"] >= df["T2M_MIN"]).all()


def test_crops_21_rows_typed():
    c = d.load_crops()
    assert len(c) == 21
    assert c.loc["barley", "ECe_100"] == 8.0 and c.loc["barley", "ECe_50"] == 18.0
    assert c.loc["barley", "root_depth_m"] == 1.25  # "1.0–1.5" -> mean
    assert bool(c.loc["cowpea", "N_fixing"]) and not bool(c.loc["barley", "N_fixing"])
    assert np.isnan(c.loc["quinoa", "ECe_100"])  # intentionally blank


def test_range_mean():
    assert d._range_mean("1.0–2.0") == 1.5
    assert d._range_mean(3) == 3.0
    assert np.isnan(d._range_mean(None))


def test_soil_baseline_values():
    s = d.load_soil_baseline()
    assert s["sand_pct"] == 86.95 and s["ece_dS_m"] == 8.56 and s["ecw_dS_m"] == 8.35
    assert s["taw_mm_per_m"] == 100.0 and s["leaching_fraction"] == 0.15


def test_profiles_normalised():
    w = d.load_farmer_profiles()
    assert list(w.columns) == ["balanced", "profit_first", "water_saving", "soil_building", "this_farmer"]
    assert np.allclose(w.sum(axis=0), 1.0)
    assert w.loc["profit", "profit_first"] == 0.5


def test_farm_profile_f001():
    f = d.load_farm_profile("F001")
    assert f.area_feddan == 5 and f.well_ECw_dS_m == 8.35 and f.water_m3_per_day == 60
    assert f.irrigation_system == "drip" and f.last_crop == "barley"
    assert f.preferred_crops == ("barley", "sorghum") and f.avoid_crops == ("tomato",)


def test_season_of():
    assert d.season_of(date(2020, 11, 3)) == ("W", 2020)
    assert d.season_of(date(2021, 4, 30)) == ("W", 2020)
    assert d.season_of(date(2021, 5, 1)) == ("S", 2021)


def test_groundwater_and_classes():
    z = d.load_groundwater_zones()
    assert z.loc[z["zone"] == "All wells", "wells"].iloc[0] == 39
    a = d.load_salinity_class_areas()
    hs = a[a["class"] == "Highly saline"].iloc[0]
    assert round(hs["share_1996"], 2) == 0.52 and round(hs["share_2022"], 2) == 0.83


def test_prices_filled_and_sourced():
    p = d.load_prices()
    assert d.prices_available(p, list(p.index))
    assert p["source"].str.len().gt(10).all()
    unsourced = ~p["source"].str.contains("http")
    assert (p.loc[unsourced, "is_assumption"] == 1).all()  # anything without a URL must be flagged
    assert set(p["is_assumption"].unique()) <= {0, 1}
