"""M7 — climate & salinity stress test and robustness.

Scenario families (Prompt 6):
  historical  — block bootstrap of agricultural years (W(y)+S(y+1)) from NASA POWER 1981→2025
  warm+1/+2   — Tmax/Tmin + 1/2 °C (ET0 recomputed, RH constant)
  rain-10/-20 — rain scaled 0.9 / 0.8 (Peff recomputed)
  cmip6_*     — monthly GDDP-CMIP6 deltas when Earth Engine data exist (else 'pending')
  ecw+1/+2    — well salinity +1 / +2 dS/m (Groundwater sheet: 'highly saline' area 52 % → 83 %, S16)

robustness = share of scenario draws where every cropped season keeps ≥ st.yield_keep of its
typical-climate yield AND final ECe ≤ starting ECe + st.ece_tol.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from . import assumptions as A
from .calibration import bank_for
from .simulate import FALLOW, BankArrays, Engine, Farm, simulate

GRID_DT = (0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0)
GRID_DRAIN = (0, -10, -20, -30)
GRID_DECW = (0, 1, 2, 3)


@dataclass(frozen=True)
class Scenario:
    """One scenario family."""

    key: str
    label_en: str
    label_ar: str
    d_t: float = 0.0
    rain_scale: float = 1.0
    d_ecw: float = 0.0


def scenario_families() -> list[Scenario]:
    """The Prompt-6 scenario families (CMIP6 handled separately)."""
    step = A.get("st.ecw_step")
    return [
        Scenario("historical", "Past climate 1981–2025", "مناخ الماضي ١٩٨١–٢٠٢٥"),
        Scenario("warm1", "+1 °C warmer", "أدفى بدرجة", d_t=1.0),
        Scenario("warm2", "+2 °C warmer", "أدفى بدرجتين", d_t=2.0),
        Scenario("dry10", "10 % less rain", "مطر أقل ١٠٪", rain_scale=0.9),
        Scenario("dry20", "20 % less rain", "مطر أقل ٢٠٪", rain_scale=0.8),
        Scenario("ecw1", f"Well +{step:g} dS/m saltier", f"البير أملح بـ {step:g} dS/m", d_ecw=step),
        Scenario("ecw2", f"Well +{2 * step:g} dS/m saltier", f"البير أملح بـ {2 * step:g} dS/m", d_ecw=2 * step),
    ]


def valid_start_years(eng: Engine) -> np.ndarray:
    """Agricultural years y (W(y) + S(y+1)) for which every plan crop has complete data."""
    years = {"W": None, "S": None}
    for (cid, part) in eng.bank.arr:
        slot = eng.crops[cid].slot
        yrs = set(eng.bank.years_available((cid, part)).tolist())
        years[slot] = yrs if years[slot] is None else years[slot] & yrs
    ys = sorted(y for y in years["W"] if (y + 1) in years["S"])
    return np.array(ys, dtype=int)


def bootstrap_years(starts: np.ndarray, n: int, seed: int) -> np.ndarray:
    """(n, 6) season-years: three agricultural years drawn with replacement → W1 S1 W2 S2 W3 S3."""
    rng = np.random.default_rng(seed)
    ag = rng.choice(starts, size=(n, 3), replace=True)
    out = np.empty((n, 6), dtype=int)
    out[:, 0::2] = ag  # winter season-year = y
    out[:, 1::2] = ag + 1  # following summer = y + 1
    return out


@lru_cache(maxsize=64)
def cached_bank(d_t: float, rain_scale: float) -> BankArrays:
    """Season bank for a climate delta (memoised; used by stress and the what-if grid)."""
    return bank_for(d_t=d_t, rain_scale=rain_scale)


def pass_mask(plan: tuple[str, ...], farm: Farm, eng: Engine, years: np.ndarray, sc: Scenario,
              base_yield: dict[int, float]) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """Boolean pass per draw + failure diagnostics."""
    bank = cached_bank(sc.d_t, sc.rain_scale) if (sc.d_t or sc.rain_scale != 1.0) else eng.bank
    r = simulate(plan, farm, eng, years=years, d_ecw=sc.d_ecw, bank=bank)
    keep = A.get("st.yield_keep")
    ok = np.ones(years.shape[0], bool)
    diag: dict[str, np.ndarray] = {}
    for i, s in enumerate(r.slots):
        if s.crop_id == FALLOW or base_yield.get(i, 0) <= 0:
            continue
        good = np.nan_to_num(s.rel_yield_pct) >= keep * base_yield[i]
        diag[f"yield_{i}"] = ~good
        diag[f"heat_{i}"] = ~good & (np.nan_to_num(s.heat_f) < 0.97)
        ok &= good
    ece_ok = r.end.ece <= farm.ece0 + A.get("st.ece_tol")
    diag["ece"] = ~ece_ok
    ok &= ece_ok
    diag["result"] = r  # type: ignore[assignment]
    return ok, diag


def robustness(plan: tuple[str, ...], farm: Farm, eng: Engine, n: int | None = None, seed: int | None = None,
               cmip6: list[Scenario] | None = None) -> dict:
    """Robustness summary for a plan: overall %, per family %, worst family and its cause."""
    n = n or int(A.get("st.n_boot"))
    seed = seed or int(A.get("st.seed"))
    years = bootstrap_years(valid_start_years(eng), n, seed)
    base = simulate(plan, farm, eng)
    base_yield = {i: float(np.nan_to_num(s.rel_yield_pct[0])) for i, s in enumerate(base.slots)}
    fams = scenario_families() + (cmip6 or [])
    per, diags = {}, {}
    for sc in fams:
        ok, d = pass_mask(plan, farm, eng, years, sc, base_yield)
        per[sc.key] = ok
        diags[sc.key] = d
    rates = {k: float(v.mean()) for k, v in per.items()}
    overall = float(np.mean(np.concatenate(list(per.values()))))
    worst = min(rates, key=rates.get)
    return {
        "robustness_pct": round(overall * 100, 1), "n_draws": n * len(fams),
        "by_scenario": [{"key": sc.key, "label_en": sc.label_en, "label_ar": sc.label_ar,
                         "pass_pct": round(rates[sc.key] * 100, 1)} for sc in fams],
        "worst": {"key": worst, "pass_pct": round(rates[worst] * 100, 1), **failure_cause(plan, diags[worst])},
        "cmip6": "included" if cmip6 else "pending",
    }


def failure_cause(plan: tuple[str, ...], diag: dict) -> dict:
    """Most frequent failure reason in a scenario family."""
    counts = {k: int(np.sum(v)) for k, v in diag.items() if k != "result"}
    if not counts or max(counts.values()) == 0:
        return {"cause": "none", "slot": None, "crop": None, "share_pct": 0.0}
    k = max((c for c in counts if not c.startswith("heat_")), key=counts.get)
    n = len(next(v for kk, v in diag.items() if kk != "result"))
    if k == "ece":
        return {"cause": "salt_buildup", "slot": None, "crop": None, "share_pct": round(counts[k] / n * 100, 1)}
    i = int(k.split("_")[1])
    heat = counts.get(f"heat_{i}", 0) > counts[k] / 2
    return {"cause": "heat" if heat else "low_yield", "slot": i, "crop": plan[i],
            "share_pct": round(counts[k] / n * 100, 1)}


def quick_risk(plan: tuple[str, ...], farm: Farm, eng: Engine) -> float:
    """Cheap robustness (0–1) for TOPSIS: st.n_boot_grid draws × the scenario families."""
    return robustness(plan, farm, eng, n=int(A.get("st.n_boot_grid")))["robustness_pct"] / 100.0


def scenario_slider(plan: tuple[str, ...], farm: Farm, eng: Engine, d_t: float, d_rain_pct: float, d_ecw: float,
                    years: np.ndarray | None = None) -> dict:
    """One what-if cell: robustness under the shifted climate + mean yields, water, final ECe (< 1 s)."""
    n = int(A.get("st.n_boot_grid"))
    years = years if years is not None else bootstrap_years(valid_start_years(eng), n, int(A.get("st.seed")))
    base = simulate(plan, farm, eng)
    base_yield = {i: float(np.nan_to_num(s.rel_yield_pct[0])) for i, s in enumerate(base.slots)}
    sc = Scenario("whatif", "", "", d_t=d_t, rain_scale=1 + d_rain_pct / 100.0, d_ecw=d_ecw)
    ok, d = pass_mask(plan, farm, eng, years, sc, base_yield)
    r = d["result"]
    return {
        "dT": d_t, "dRain": d_rain_pct, "dECw": d_ecw, "robustness": round(float(ok.mean()) * 100, 1),
        "rel_yield": [None if s.crop_id == FALLOW else round(float(np.nanmean(s.rel_yield_pct)), 1) for s in r.slots],
        "yield_kg_ha": [round(float(np.nanmean(s.yield_kg_ha))) for s in r.slots],
        "water_m3": round(float(np.mean(r.water_m3))), "ece_end": round(float(np.mean(r.end.ece)), 2),
    }


def whatif_grid(plan: tuple[str, ...], farm: Farm, eng: Engine) -> list[dict]:
    """All 7 × 4 × 4 = 112 what-if cells for the web sliders."""
    n = int(A.get("st.n_boot_grid"))
    years = bootstrap_years(valid_start_years(eng), n, int(A.get("st.seed")))
    return [scenario_slider(plan, farm, eng, dt, dr, de, years) for dt in GRID_DT for dr in GRID_DRAIN
            for de in GRID_DECW]
