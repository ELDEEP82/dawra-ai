"""Run the whole Dawra pipeline and export static JSON to web/public/data/.

Grid: farm F001 × 5 priority profiles × well ECw {5, 6.5, 8.35, 10, 12} dS/m × water {40, 60, 90} m³/day.
Per plan: seasons, totals, soil trajectory, robustness, 5-field EN/AR card and a 7×4×4 what-if grid.
Also: meta.json, climate.json, evidence.json (NASA datasets & EO status), map.json.

Usage:  python build.py [--workers N] [--quick]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE))

from dawra import assumptions as A  # noqa: E402
from dawra import optimizer as O  # noqa: E402
from dawra import stress as S  # noqa: E402
from dawra.calibration import build_engine, climate_daily, default_farm  # noqa: E402
from dawra.climate import annual_summary, extreme_seasons, monthly_climatology, season_table  # noqa: E402
from dawra.config import (POWER_LAT, POWER_LON, STATION_LAT, STATION_LON, WEB_DATA)  # noqa: E402
from dawra.context import PROFILE_AR, card_context, climate_summary  # noqa: E402
from dawra.crop_params import CROP_AR  # noqa: E402
from dawra.data_io import (load_farm_profile, load_farmer_profiles, load_groundwater_zones,  # noqa: E402
                           load_s1_climate, load_salinity_class_areas, load_sources, prices_available)
from dawra.eo import AOI_BBOX, eo_status  # noqa: E402
from dawra.eo_report import PRODUCTS  # noqa: E402
from dawra.explain import card  # noqa: E402
from dawra.export import plan_json  # noqa: E402

ECW_OPTS = (5.0, 6.5, 8.35, 10.0, 12.0)
WATER_OPTS = (40.0, 60.0, 90.0)
PROFILES = ("balanced", "profit_first", "water_saving", "soil_building", "this_farmer")
_ENG = None


def key(ecw: float, water: float, profile: str) -> str:
    """File stem for one configuration, e.g. 'ecw-8.35_water-60_balanced'."""
    return f"ecw-{ecw:g}_water-{water:g}_{profile}"


def dump(path: Path, obj: object) -> int:
    """Write compact UTF-8 JSON; return bytes written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(txt, encoding="utf-8")
    return len(txt.encode("utf-8"))


def _engine():
    global _ENG
    if _ENG is None:
        _ENG = build_engine()[0]
    return _ENG


# --------------------------------------------------------------------------- one (ecw, water) configuration
def run_config(args: tuple[float, float, bool]) -> dict:
    """Optimise one farm configuration and export the 5 profile files. Runs in a worker process."""
    ecw, water, quick = args
    t0 = time.time()
    eng = _engine()
    farm = default_farm(ecw=ecw, water=water)
    pop, gen = (40, 30) if quick else (None, None)
    front, ev = O.run(eng, farm, pop=pop, gen=gen)
    cur = ev(O.current_plan(farm.last_crop))
    O.attach_risk(front + [cur], lambda p: S.quick_risk(p, farm, eng))
    picks = O.pick_extremes(front, cur)
    weights = load_farmer_profiles()
    comps = {pr: O.compromise(front, weights[pr].to_dict())[0] for pr in PROFILES}
    priced = prices_available(eng.prices, list(eng.crops))
    status = eo_status()

    unique = {e.plan: e for e in [cur, *picks.values(), *comps.values()]}
    rob = {p: S.robustness(p, farm, eng) for p in unique}
    grid = {p: S.whatif_grid(p, farm, eng) for p in unique}
    front_pts = [{"water_m3": round(e.water_m3), "value": round(e.value, 4), "soil": round(e.soil_index, 1),
                  "risk": round((e.risk or 0) * 100, 1), "plan": list(e.plan)} for e in front]
    sizes = 0
    for pr in PROFILES:
        chosen = {"current": cur, **picks, "compromise": comps[pr]}
        plans = []
        for kind, e in chosen.items():
            pj = plan_json(e, kind, eng, farm, cur, priced)
            pj["robustness"] = rob[e.plan]
            pj["whatif"] = grid[e.plan]
            pj["same_as"] = [k for k, o in chosen.items() if k != kind and o.plan == e.plan]
            plans.append(pj)
        cur_j = plans[0]
        ctx = card_context(eng, ecw, pr, weights[pr].to_dict(), len(front), not priced, status)
        for pj in plans:
            pj["explanation"] = card(pj, cur_j, ctx)
        out = {"farm_id": farm.farm_id, "ecw": ecw, "water_m3_day": water, "profile": pr,
               "profile_ar": PROFILE_AR[pr], "weights": weights[pr].round(4).to_dict(), "prices_pending": not priced,
               "eo_status": status, "front_size": len(front), "evaluated": len(ev.cache), "front": front_pts,
               "plans": plans}
        sizes += dump(WEB_DATA / "plans" / f"{key(ecw, water, pr)}.json", out)
    return {"ecw": ecw, "water": water, "front": len(front), "unique": len(unique), "kb": sizes // 1024,
            "s": round(time.time() - t0, 1)}


# --------------------------------------------------------------------------- shared JSON
def export_meta(eng) -> None:
    """meta.json: options, profiles, crops, sources, scenario labels."""
    fp = load_farm_profile("F001")
    w = load_farmer_profiles()
    srcs = load_sources()
    dump(WEB_DATA / "meta.json", {
        "built_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "farm": fp.__dict__, "ecw_options": list(ECW_OPTS), "water_options": list(WATER_OPTS),
        "profiles": [{"id": p, "label_ar": PROFILE_AR[p], "weights": w[p].round(4).to_dict()} for p in PROFILES],
        "prices_pending": not prices_available(eng.prices, list(eng.crops)), "eo_status": eo_status(),
        "grid": {"dT": list(S.GRID_DT), "dRain": list(S.GRID_DRAIN), "dECw": list(S.GRID_DECW)},
        "scenarios": [{"key": s.key, "label_en": s.label_en, "label_ar": s.label_ar} for s in S.scenario_families()],
        "crops": [{"id": c.crop_id, "en": c.crop_en, "ar": CROP_AR[c.crop_id], "family": c.family, "use": c.use,
                   "slot": c.slot, "perennial": c.perennial, "salt_rating": c.salt_rating, "ymax": None if c.ymax != c.ymax else round(c.ymax),
                   "ymax_source": c.ymax_source} for c in eng.crops.values()],
        "sources": srcs.to_dict(orient="records"),
        "n_assumptions": int(len(A.table())), "k_cal": round(eng.k_cal, 3),
    })


def export_climate() -> None:
    """climate.json: annual series, monthly climatology vs S1, extremes, summary."""
    df = climate_daily()
    ann = annual_summary(df)
    ann = ann[ann.index <= 2025]
    mon = monthly_climatology(df, 1991, 2020)
    s1 = load_s1_climate().set_index("month_num")
    ext = extreme_seasons(season_table(df))
    dump(WEB_DATA / "climate.json", {
        "source": "NASA POWER daily (community AG), pixel 29.5907 N 32.7203 E; ET0 = FAO-56 Penman–Monteith",
        "summary": climate_summary(),
        "annual": [{"year": int(y), "et0": round(r.ET0_mm), "rain": round(r.rain_mm, 1), "tmax": round(r.tmax_mean, 2),
                    "tmin": round(r.tmin_mean, 2), "heat_days": int(r.heat_days), "gwet": round(r.gwetroot, 3)}
                   for y, r in ann.iterrows()],
        "monthly": [{"month": int(m), "tmin": round(r.T2M_MIN, 1), "tmax": round(r.T2M_MAX, 1),
                     "rain": round(r.PRECTOTCORR, 1), "et0": round(r.ET0, 0), "gwet": round(r.GWETROOT, 3),
                     "s1_tmin": float(s1.at[m, "tmin"]) if m in s1.index else None,
                     "s1_tmax": float(s1.at[m, "tmax"]) if m in s1.index else None,
                     "s1_rain": float(s1.at[m, "precip"]) if m in s1.index else None} for m, r in mon.iterrows()],
        "hottest": ext["hottest"][["season_year", "season", "tmax_mean", "tmax_anom", "heat_days"]].round(2).to_dict(
            orient="records"),
        "driest": ext["driest"][["season_year", "season", "rain_mm", "ET0_mm"]].round(1).to_dict(orient="records"),
    })


def export_evidence() -> None:
    """evidence.json: NASA datasets used + EO status + groundwater facts (for credits & snapshot pages)."""
    st = eo_status()
    areas = load_salinity_class_areas()
    zones = load_groundwater_zones()
    dump(WEB_DATA / "evidence.json", {
        "eo_status": st,
        "used_now": [
            {"name": "NASA POWER (daily, community AG)", "vars": "CERES SYN1deg radiation; MERRA-2 T2M min/max, RH2M, "
             "WS2M, PRECTOTCORR, GWETROOT", "url": "https://power.larc.nasa.gov/", "status": "used"},
        ],
        "earth_engine": [{"product": p, "dataset": d, "ee_id": i, "use": u, "status": st} for p, d, i, u in PRODUCTS],
        "ndvi": None if st == "pending" else "see data/eo",
        "salinity_classes": areas[["class", "share_1996", "share_2022"]].round(3).to_dict(orient="records"),
        "zones": zones[["zone", "wells", "mean_ECw_dS_m"]].to_dict(orient="records"),
    })


def export_map() -> None:
    """map.json: markers and AOI (field polygons when EO exists)."""
    fields = None
    gj = sorted((ENGINE.parent / "data" / "eo").glob("fields_*.geojson"))
    if gj:
        fields = json.loads(gj[-1].read_text(encoding="utf-8"))
    dump(WEB_DATA / "map.json", {
        "center": [29.60, 32.70], "zoom": 12,
        "markers": [
            {"id": "drc", "lat": STATION_LAT, "lon": STATION_LON, "en": "DRC Ras Sudr research station (S1)",
             "ar": "محطة بحوث الصحراء برأس سدر (S1)"},
            {"id": "quinoa", "lat": 29.541111, "lon": 32.656944, "en": "Quinoa trial station (S4)",
             "ar": "محطة تجارب الكينوا (S4)"},
            {"id": "power", "lat": POWER_LAT, "lon": POWER_LON, "en": "NASA POWER pixel centre",
             "ar": "مركز بكسل ناسا POWER"},
        ],
        "aoi_bbox": list(AOI_BBOX), "fields": fields, "fields_status": "ok" if fields else "pending",
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--quick", action="store_true", help="small GA for a fast smoke build")
    a = ap.parse_args()
    t0 = time.time()
    eng = _engine()
    export_meta(eng)
    export_climate()
    export_evidence()
    export_map()
    jobs = [(e, w, a.quick) for e in ECW_OPTS for w in WATER_OPTS]
    with ProcessPoolExecutor(max_workers=a.workers) as pool:
        for r in pool.map(run_config, jobs):
            print(f"  ECw {r['ecw']:>5} | water {r['water']:>4} | front {r['front']:>3} | unique {r['unique']} | "
                  f"{r['kb']} KB | {r['s']} s", flush=True)
    print(f"build done in {time.time() - t0:.0f} s → {WEB_DATA}")


if __name__ == "__main__":
    main()
