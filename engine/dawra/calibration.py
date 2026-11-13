"""Builds the calibrated :class:`~dawra.simulate.Engine` and runs the local checks.

* ECe/ECw calibration: S4 measured ECe 8.56 at ECw 7.94 (Soil_Water_Measured).
* Barley grain ymax: S1 4,215 kg/ha at ECw 8.35, furrow, early sowing, seasons 2018/19–2019/20.
* Barley forage ymax: S1 fresh forage 15,456 kg/ha, same trial.
* Wheat holdout (not used for fitting): S6 16.5 ardeb ≈ 2.48 t per feddan at ~5,000 ppm, season 2025/26.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd

from . import assumptions as A
from .climate import add_derived, extend_power
from .config import HA_PER_FEDDAN
from .crop_params import Crop, build_crops
from .data_io import load_farm_profile, load_local_yields, load_prices, load_soil_baseline, measured_value
from .simulate import BankArrays, Engine, Farm
from .soil_twin import ece_calibration_factor, ece_steady, mix_ece
from .water_salt import build_bank, drainage_mm, efficiency, gross_irrigation, leaching_requirement
from .yield_model import calibrate_ymax, expected_yield, heat_factor, salt_rel_yield, with_ymax

S1_SEASONS = (2018, 2019)  # Sources S1: seasons 2018/19–2019/20 (winter season-year = year of November)
S6_SEASON = 2025  # Sources S6: news of April 2026 → winter 2025/26


@dataclass(frozen=True)
class CheckResult:
    """A calibration/validation number with its target."""

    name: str
    modelled: float
    observed: float
    unit: str
    source: str

    @property
    def error_pct(self) -> float:
        """Relative error % (modelled vs observed)."""
        return (self.modelled / self.observed - 1.0) * 100.0


def _local_yield(metric_contains: str) -> float:
    """Numeric value from Local_Yields whose Metric contains the text."""
    t = load_local_yields()
    row = t[t["Metric"].astype(str).str.contains(metric_contains, regex=False)].iloc[0]
    return float(row["Value"])


def season_conditions(crop: Crop, bank: BankArrays, years: tuple[int, ...], ecw: float, ece0: float,
                      system: str, theta_fc: float, k_cal: float, applied_mm: float | None = None) -> dict[str, float]:
    """Mean modelled ECe, hot days, water for a crop at given seasons and water salinity.

    ``applied_mm`` uses an observed seasonal application instead of the FAO-29 gross requirement.
    """
    ece_means, hots, gross_l = [], [], []
    for y in years:
        key = (crop.crop_id, 0)
        etc = bank.gather(key, np.array([y]), "etc")[0]
        peff = bank.gather(key, np.array([y]), "peff")[0]
        hot = bank.gather(key, np.array([y]), "hot_mid")[0]
        lr = leaching_requirement(ecw, crop.ece100)
        gross = float(gross_irrigation(etc, peff, lr, efficiency(system))) if applied_mm is None else applied_mm
        drain = float(drainage_mm(gross, etc, peff))
        lf = drain / max(gross + peff, 1e-9)
        _, mean = mix_ece(ece0, ece_steady(ecw, lf, k_cal), drain, crop.root_m, theta_fc)
        ece_means.append(float(mean))
        hots.append(hot)
        gross_l.append(gross)
    return {"ece_mean": float(np.mean(ece_means)), "hot_mid": float(np.mean(hots)), "gross_mm": float(np.mean(gross_l))}


@lru_cache(maxsize=1)
def climate_daily() -> pd.DataFrame:
    """Extended POWER daily frame with ET0 and Peff (cached in memory)."""
    return add_derived(extend_power())


def bank_for(d_t: float = 0.0, rain_scale: float = 1.0, crops: dict[str, Crop] | None = None) -> BankArrays:
    """Season bank for a (possibly warmed / drier) climate."""
    raw = extend_power()
    clim = add_derived(raw, d_t=d_t, rain_scale=rain_scale) if (d_t or rain_scale != 1.0) else climate_daily()
    crops = crops or build_crops()
    return BankArrays(build_bank(clim, crops), int(A.get("clim.normal_start")), int(A.get("clim.normal_end")))


def default_farm(ecw: float | None = None, water: float | None = None, farmer_id: str = "F001") -> Farm:
    """F001 from Farmer_Priorities + Soil_Baseline, optionally with another well ECw / water supply."""
    fp = load_farm_profile(farmer_id)
    sb = load_soil_baseline()
    return Farm(
        farm_id=fp.farmer_id, area_fdn=fp.area_feddan, ecw=fp.well_ECw_dS_m if ecw is None else ecw,
        water_m3_day=fp.water_m3_per_day if water is None else water, system=fp.irrigation_system,
        livestock=fp.livestock_heads, preferred=fp.preferred_crops, avoid=fp.avoid_crops, last_crop=fp.last_crop,
        ece0=float(sb["ece_dS_m"]), soc0=float(sb["soc_pct"]), n0=float(sb["avail_N_mg_kg"]),
        theta_fc=float(sb["theta_fc"]),
    )


def build_engine(bank: BankArrays | None = None) -> tuple[Engine, dict[str, object]]:
    """Calibrated engine plus a dict of calibration/holdout results."""
    crops = dict(build_crops())
    bank = bank or bank_for(crops=crops)
    sb = load_soil_baseline()
    ece_meas = float(sb["ece_dS_m"])
    ecw_s4 = measured_value("Water", "EC", "S4")
    k_cal = ece_calibration_factor(ece_meas, ecw_s4)
    theta = float(sb["theta_fc"])
    ecw_s1 = measured_value("Water", "EC", "S1")
    s1_sys = A.get_str("cal.s1_system")

    s1_applied = _local_yield("Seasonal irrigation applied")  # 400 mm furrow (S1)
    cal = {}
    for cid, metric in (("barley", "Grain yield, early sowing"), ("barley_forage", "Fresh forage yield, early sowing")):
        obs = _local_yield(metric)
        cond = season_conditions(crops[cid], bank, S1_SEASONS, ecw_s1, ece_meas, s1_sys, theta, k_cal, s1_applied)
        c = calibrate_ymax(crops[cid], obs, cond["ece_mean"], cond["hot_mid"], "S1 (Local_Yields)")
        crops[cid] = with_ymax(crops[cid], c.ymax_kg_ha, f"calibrated to S1 {obs:,.0f} kg/ha")
        cal[cid] = {"calibration": c, "conditions": cond}

    # holdout: wheat (S6), not fitted
    ecw_s6 = measured_value("Water", "TDS", "S6") / A.get("conv.tds_per_ec")
    w = crops["wheat"]
    cond = season_conditions(w, bank, (S6_SEASON,), ecw_s6, ece_meas, A.get_str("cal.s6_system"), theta, k_cal)
    pred = float(expected_yield(w, cond["ece_mean"], cond["hot_mid"]))
    obs_t_fdn = 2.48  # Local_Yields: "16.5 ardeb (~2.48 t)" per feddan (S6) — parsed below for traceability
    txt = str(load_local_yields().query("Crop == 'Wheat'")["Value"].iloc[0])
    obs_t_fdn = float(txt.split("~")[1].split("t")[0]) if "~" in txt else obs_t_fdn
    holdout = {
        "per_feddan": CheckResult("wheat holdout (t/feddan reading)", pred, obs_t_fdn * 1000 / HA_PER_FEDDAN,
                                  "kg/ha", "S6"),
        "per_ha": CheckResult("wheat holdout (t/ha reading)", pred, obs_t_fdn * 1000, "kg/ha", "S6"),
        "conditions": cond, "ecw": ecw_s6,
    }
    # S1 water check: FAO-29 furrow gross requirement vs the ~400 mm actually applied
    req = season_conditions(crops["barley"], bank, S1_SEASONS, ecw_s1, ece_meas, s1_sys, theta, k_cal)
    s1_water = CheckResult("barley seasonal gross requirement (furrow, with LR)", req["gross_mm"], s1_applied, "mm",
                           "S1")
    ece_check = CheckResult("ECe at ECw 7.94, LF 0.15", float(ece_steady(ecw_s4, A.get("soil.lf_cal"), k_cal)),
                            ece_meas, "dS/m", "S4")
    info = {"k_cal": k_cal, "calibration": cal, "holdout": holdout, "s1_water": s1_water, "ece_check": ece_check,
            "ecw_s1": ecw_s1, "ecw_s4": ecw_s4}
    return Engine(crops=crops, bank=bank, k_cal=k_cal, prices=load_prices()), info
