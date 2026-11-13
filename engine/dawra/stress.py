"""M7 — climate, salinity and management stress test; robustness, uncertainty bands, what-if grid.

Scenario families:
  historical  — block bootstrap of agricultural years (W(y)+S(y+1)) from NASA POWER 1981→2025
  warm1/2     — Tmax/Tmin + 1/2 °C (ET0 recomputed, RH constant)
  dry10/20    — rain × 0.9 / 0.8 (Peff recomputed)
  cmip_ssp245/585 — NEX-GDDP-CMIP6 5-model ensemble monthly deltas 2041–2060 vs 1995–2014 (Tmax, rain)
  ecw1/2      — well salinity +1 / +2 dS/m ('highly saline' aquifer area 52 % → 83 %, S16)
crossed with the *leaching achieved* by the farmer: 100 %, 70 %, 40 % of the FAO-29 requirement
(the S1 trial applied 400 mm against a 693 mm requirement — under-leaching is real).

robustness = share of (family × leaching × draw) cases where every cropped season keeps ≥ st.yield_keep of
its typical-climate, full-leaching yield AND final ECe ≤ starting ECe + st.ece_tol.
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
GRID_LEACH = (1.0, 0.7, 0.4)
WHATIF_COLS = ("robustness", "water_m3", "ece_end", "profit_egp", "y1", "y2", "y3", "y4", "y5", "y6")


@dataclass(frozen=True)
class Scenario:
    """One scenario family."""

    key: str
    label_en: str
    label_ar: str
    d_t: float = 0.0
    rain_scale: float = 1.0
    d_ecw: float = 0.0
    cmip: str | None = None


def leach_levels() -> tuple[float, float, float]:
    """Leaching achieved as a share of the requirement (st.leach_full / mid / low)."""
    return (A.get("st.leach_full"), A.get("st.leach_mid"), A.get("st.leach_low"))


def scenario_families(include_cmip: bool = True) -> list[Scenario]:
    """Prompt-6 families plus CMIP6 ensemble futures when the deltas exist."""
    step = A.get("st.ecw_step")
    fams = [
        Scenario("historical", "Past climate 1981–2025", "مناخ الماضي 1981–2025"),
        Scenario("warm1", "+1 °C warmer", "أدفى بدرجة", d_t=1.0),
        Scenario("warm2", "+2 °C warmer", "أدفى بدرجتين", d_t=2.0),
        Scenario("dry10", "10 % less rain", "مطر أقل 10٪", rain_scale=0.9),
        Scenario("dry20", "20 % less rain", "مطر أقل 20٪", rain_scale=0.8),
        Scenario("ecw1", f"Well +{step:g} dS/m saltier", f"البير أملح بـ {step:g} dS/m", d_ecw=step),
        Scenario("ecw2", f"Well +{2 * step:g} dS/m saltier", f"البير أملح بـ {2 * step:g} dS/m", d_ecw=2 * step),
    ]
    if include_cmip:
        from .eo import cmip6_ensemble  # noqa: PLC0415

        ens = cmip6_ensemble()
        for scen, lab_en, lab_ar in (("ssp245", "2050s, SSP2-4.5 (CMIP6)", "الخمسينات، SSP2-4.5 (CMIP6)"),
                                     ("ssp585", "2050s, SSP5-8.5 (CMIP6)", "الخمسينات، SSP5-8.5 (CMIP6)")):
            if scen in ens:
                fams.append(Scenario(f"cmip_{scen}", lab_en, lab_ar, cmip=scen))
    return fams


def valid_start_years(eng: Engine) -> np.ndarray:
    """Agricultural years y (W(y) + S(y+1)) for which every plan crop has complete data."""
    years: dict[str, set | None] = {"W": None, "S": None}
    for (cid, part) in eng.bank.arr:
        slot = eng.crops[cid].slot
        yrs = set(eng.bank.years_available((cid, part)).tolist())
        years[slot] = yrs if years[slot] is None else years[slot] & yrs
    return np.array(sorted(y for y in years["W"] if (y + 1) in years["S"]), dtype=int)


def bootstrap_years(starts: np.ndarray, n: int, seed: int) -> np.ndarray:
    """(n, 6) season-years: three agricultural years drawn with replacement → W1 S1 W2 S2 W3 S3."""
    rng = np.random.default_rng(seed)
    ag = rng.choice(starts, size=(n, 3), replace=True)
    out = np.empty((n, 6), dtype=int)
    out[:, 0::2] = ag
    out[:, 1::2] = ag + 1
    return out


@lru_cache(maxsize=64)
def cached_bank(d_t: float, rain_scale: float) -> BankArrays:
    """Season bank for a uniform climate delta (memoised)."""
    return bank_for(d_t=d_t, rain_scale=rain_scale)


@lru_cache(maxsize=4)
def cmip_bank(scen: str) -> BankArrays:
    """Season bank with the CMIP6 ensemble monthly deltas applied to the historical record."""
    from .eo import cmip6_ensemble  # noqa: PLC0415

    e = cmip6_ensemble()[scen]
    return bank_for(d_t=tuple(e["d_t"]), rain_scale=tuple(e["rain_scale"]))


def bank_of(sc: Scenario, eng: Engine) -> BankArrays:
    """Climate bank for a scenario."""
    if sc.cmip:
        return cmip_bank(sc.cmip)
    if sc.d_t or sc.rain_scale != 1.0:
        return cached_bank(sc.d_t, sc.rain_scale)
    return eng.bank


def base_yields(plan, farm, eng, area_frac) -> dict[int, float]:
    """Typical-climate, full-leaching relative yield per slot (the plan's expectation)."""
    base = simulate(plan, farm, eng, area_frac=area_frac)
    return {i: float(np.nan_to_num(s.rel_yield_pct[0])) for i, s in enumerate(base.slots)}


def pass_mask(plan, farm: Farm, eng: Engine, years: np.ndarray, sc: Scenario, base_yield: dict[int, float],
              area_frac=None, leach: float = 1.0):
    """Boolean pass per draw, failure diagnostics, and the simulation result."""
    r = simulate(plan, farm, eng, years=years, d_ecw=sc.d_ecw, bank=bank_of(sc, eng), area_frac=area_frac,
                 leach=leach)
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
    return ok, diag, r


def failure_cause(plan, diag: dict) -> dict:
    """Most frequent failure reason in a set of draws."""
    counts = {k: int(np.sum(v)) for k, v in diag.items()}
    if not counts or max(counts.values()) == 0:
        return {"cause": "none", "slot": None, "crop": None, "share_pct": 0.0}
    k = max((c for c in counts if not c.startswith("heat_")), key=counts.get)
    n = len(next(iter(diag.values())))
    if k == "ece":
        return {"cause": "salt_buildup", "slot": None, "crop": None, "share_pct": round(counts[k] / n * 100, 1)}
    i = int(k.split("_")[1])
    heat = counts.get(f"heat_{i}", 0) > counts[k] / 2
    return {"cause": "heat" if heat else "low_yield", "slot": i, "crop": plan[i],
            "share_pct": round(counts[k] / n * 100, 1)}


def _pct(x) -> dict[str, float]:
    p10, p50, p90 = np.nanpercentile(np.asarray(x, float), [10, 50, 90])
    return {"p10": float(p10), "p50": float(p50), "p90": float(p90)}


def _pass_rate(diag: dict) -> float:
    return float(np.mean(~np.any(np.vstack(list(diag.values())), axis=0))) if diag else 1.0


def robustness(plan, farm: Farm, eng: Engine, area_frac=None, n: int | None = None, seed: int | None = None,
               with_bands: bool = True) -> dict:
    """Robustness over scenario families × leaching levels, plus P10/P50/P90 bands (historical, full leaching)."""
    n = n or int(A.get("st.n_boot"))
    seed = seed or int(A.get("st.seed"))
    years = bootstrap_years(valid_start_years(eng), n, seed)
    by = base_yields(plan, farm, eng, area_frac)
    fams = scenario_families()
    levels = leach_levels()
    per_f: dict[str, list[np.ndarray]] = {sc.key: [] for sc in fams}
    per_l: dict[float, list[np.ndarray]] = {lv: [] for lv in levels}
    diag_all: dict[str, dict] = {}
    bands = None
    paths: dict[str, dict] = {}
    for sc in fams:
        for lv in levels:
            ok, d, r = pass_mask(plan, farm, eng, years, sc, by, area_frac, lv)
            per_f[sc.key].append(ok)
            per_l[lv].append(ok)
            diag_all[f"{sc.key}|{lv}"] = d
            if with_bands and sc.key == "historical" and lv in (levels[0], levels[1]):
                k = 40
                traj = np.vstack([np.asarray(st.ece) for st in r.trajectory])[:, :k]  # (7 states, k draws)
                paths[str(int(round(lv * 100)))] = {"ece": np.round(traj.T, 2).tolist(), "pass": ok[:k].tolist()}
            if with_bands and sc.key == "historical" and lv == levels[0]:
                bands = {"product_t": {k: round(v / 1000, 2) for k, v in _pct(r.product_kg).items()},
                         "profit_egp": {k: round(v) for k, v in _pct(r.profit_egp).items()}
                         if r.profit_egp is not None else None,
                         "ece_end": {k: round(v, 2) for k, v in _pct(r.end.ece).items()}}
    allok = np.concatenate([np.concatenate(v) for v in per_f.values()])
    worst_cell = min(diag_all, key=lambda k: _pass_rate(diag_all[k]))
    wk, wl = worst_cell.split("|")
    salt = {lv: float(np.mean(np.concatenate([diag_all[f"{sc.key}|{lv}"]["ece"] for sc in fams]))) for lv in levels}
    return {
        "robustness_pct": round(float(allok.mean()) * 100, 1), "n_draws": int(allok.size),
        "by_scenario": [{"key": sc.key, "label_en": sc.label_en, "label_ar": sc.label_ar,
                         "pass_pct": round(float(np.concatenate(per_f[sc.key]).mean()) * 100, 1)} for sc in fams],
        "by_leaching": [{"leach_pct": int(round(lv * 100)), "pass_pct": round(float(np.concatenate(per_l[lv]).mean())
                                                                               * 100, 1),
                         "salt_buildup_pct": round(salt[lv] * 100, 1)} for lv in levels],
        "worst": {"key": wk, "leach_pct": int(round(float(wl) * 100)),
                  "pass_pct": round(_pass_rate(diag_all[worst_cell]) * 100, 1),
                  **failure_cause(plan, diag_all[worst_cell])},
        "bands": bands, "paths": paths or None,
        "cmip6": "included" if any(sc.cmip for sc in fams) else "pending",
    }


def quick_risk(e, farm: Farm, eng: Engine) -> float:
    """Cheap robustness (0–1) for TOPSIS: st.n_boot_grid draws, no bands."""
    return robustness(e.plan, farm, eng, area_frac=e.area_frac, n=int(A.get("st.n_boot_grid")),
                      with_bands=False)["robustness_pct"] / 100.0


def scenario_slider(plan, farm: Farm, eng: Engine, d_t: float, d_rain_pct: float, d_ecw: float, leach: float = 1.0,
                    area_frac=None, years: np.ndarray | None = None, base: dict | None = None) -> list:
    """One what-if cell as a compact row in WHATIF_COLS order."""
    n = int(A.get("st.n_boot_grid"))
    years = years if years is not None else bootstrap_years(valid_start_years(eng), n, int(A.get("st.seed")))
    base = base or base_yields(plan, farm, eng, area_frac)
    sc = Scenario("whatif", "", "", d_t=d_t, rain_scale=1 + d_rain_pct / 100.0, d_ecw=d_ecw)
    ok, _, r = pass_mask(plan, farm, eng, years, sc, base, area_frac, leach)
    ys = [None if s.crop_id == FALLOW else round(float(np.nanmean(s.rel_yield_pct)), 1) for s in r.slots]
    profit = round(float(np.mean(r.profit_egp))) if r.profit_egp is not None else None
    return [round(float(ok.mean()) * 100, 1), round(float(np.mean(r.water_m3))), round(float(np.mean(r.end.ece)), 2),
            profit, *ys]


def whatif_grid(plan, farm: Farm, eng: Engine, area_frac=None) -> dict:
    """7 × 4 × 4 × 3 = 336 cells: axes + rows (dT-major, then dRain, dECw, leach)."""
    n = int(A.get("st.n_boot_grid"))
    years = bootstrap_years(valid_start_years(eng), n, int(A.get("st.seed")))
    base = base_yields(plan, farm, eng, area_frac)
    rows = [scenario_slider(plan, farm, eng, dt, dr, de, lv, area_frac, years, base)
            for dt in GRID_DT for dr in GRID_DRAIN for de in GRID_DECW for lv in GRID_LEACH]
    return {"axes": {"dT": list(GRID_DT), "dRain": list(GRID_DRAIN), "dECw": list(GRID_DECW),
                     "leach": [int(x * 100) for x in GRID_LEACH]}, "cols": list(WHATIF_COLS), "rows": rows}
