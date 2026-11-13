"""Tests for eo.py (mocked Earth Engine) and evidence.py (synthetic NDVI)."""
from unittest import mock

import numpy as np
import pandas as pd
import pytest

from dawra import eo
from dawra import evidence as E


# ---------------------------------------------------------------- eo with mocks
def test_extract_all_pending_when_not_authenticated(monkeypatch, tmp_path):
    monkeypatch.setattr(eo, "_EE", None)
    monkeypatch.setattr(eo, "EO_DIR", tmp_path / "eo")
    with mock.patch.dict("sys.modules", {"ee": mock.MagicMock(Initialize=mock.Mock(side_effect=Exception("auth")))}):
        st = eo.extract_all()
    assert st["status"] == "pending" and "earthengine authenticate" in st["message"]


def test_extract_all_runs_extractors_with_fake_ee(monkeypatch, tmp_path):
    monkeypatch.setattr(eo, "EO_DIR", tmp_path / "eo")
    monkeypatch.setattr(eo, "_EE", mock.MagicMock())
    calls = []
    monkeypatch.setattr(eo, "EXTRACTORS", {"a": lambda: calls.append("a"), "b": mock.Mock(side_effect=RuntimeError("x"))})
    st = eo.extract_all()
    assert calls == ["a"] and st["status"] == "partial" and "b" in st["failed"]


def test_region_series_parses_features():
    fake = mock.MagicMock()
    col = mock.MagicMock()
    col.size.return_value.getInfo.return_value = 2
    fake.FeatureCollection.return_value.getInfo.return_value = {"features": [
        {"properties": {"date": "2020-01-02", "ndvi": 0.2}}, {"properties": {"date": "2020-01-01", "ndvi": 0.1}}]}
    df = eo._region_series(fake, col, None, ["ndvi"], 30)
    assert list(df["ndvi"]) == [0.1, 0.2] and str(df["date"].dtype).startswith("datetime64")


def test_linear_trend_and_heavy_days():
    d = pd.DataFrame({"date": pd.date_range("2002-01-01", periods=60, freq="MS")})
    d["lwe"] = -1.0 * (d["date"] - d["date"].min()).dt.days / 365.25 + 3
    assert eo.linear_trend(d, "lwe") == pytest.approx(-1.0, abs=1e-6)
    p = pd.DataFrame({"date": pd.date_range("2020-01-01", periods=5), "precip_mm": [0, 12, 25, 3, 0]})
    h = eo.imerg_heavy_days(p)
    assert h.loc[2020, "days_gt10"] == 2 and h.loc[2020, "days_gt20"] == 1


def test_eo_status_pending_without_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(eo, "EO_DIR", tmp_path)
    assert eo.eo_status() == "pending"


# ---------------------------------------------------------------- evidence on synthetic NDVI
def synthetic(years=4, summer_crop=False, seed=0):
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2019-11-01", periods=years * 23, freq="16D")
    doy = dates.dayofyear.to_numpy()
    winter = 0.45 * np.exp(-0.5 * ((((doy - 45) + 182) % 365 - 182) / 25) ** 2)  # peak mid-Feb
    summer = 0.40 * np.exp(-0.5 * ((doy - 220) / 20) ** 2) if summer_crop else 0
    return pd.DataFrame({"date": dates, "ndvi": 0.1 + winter + summer + rng.normal(0, 0.01, len(dates))})


def test_phenology_and_rules_barley_fallow():
    s = E.smooth_16d(synthetic())
    f = E.phenology(s)
    lab = E.classify_season(f)
    w = lab[f["season"] == "W"]
    sm = lab[f["season"] == "S"]
    assert (w == "winter_crop").mean() > 0.6 and (sm == "bare").mean() > 0.6
    assert E.current_rotation_guess(f, lab) == ["winter_crop", "bare"]
    cal = E.bare_calendar(f, lab).set_index("season")["bare_share"]
    assert cal["S"] > cal["W"]


def test_summer_crop_detected_and_kmeans_runs():
    f = E.phenology(E.smooth_16d(synthetic(summer_crop=True)))
    lab = E.classify_season(f)
    assert (lab[f["season"] == "S"] == "summer_crop").mean() > 0.6
    assert 0 <= E.kmeans_agreement(f, lab) <= 1


def test_vulnerable_and_transitions():
    f = E.phenology(E.smooth_16d(synthetic(years=6)))
    lab = E.classify_season(f)
    stress = f.set_index(["season_year", "season"])[["peak"]].rename(columns={"peak": "heat_days"}) * -100
    v = E.vulnerable_seasons(f, stress)
    assert set(v.columns) >= {"season_year", "season", "peak"}
    allf = f.assign(label=lab.to_numpy(), field_id="F1")
    t = E.transition_evidence(allf)
    assert {"prev_label", "next_peak_mean", "n", "caveat"} <= set(t.columns)


def test_vegetated_area_check():
    assert E.vegetated_area_check(1600)["pass"] and not E.vegetated_area_check(3000)["pass"]
