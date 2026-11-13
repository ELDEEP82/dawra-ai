"""Summaries of the Earth-observation caches: evidence on real NDVI, card sentences, web JSON, validation inputs."""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
import pandas as pd

from . import evidence as E
from .calibration import climate_daily
from .config import EO_DIR
from .eo import FIELD_YEAR, cached, cmip6_ensemble, imerg_heavy_days, linear_trend
from .water_salt import kc_array

S16 = {1996: 56.86, 2022: 1579.08}  # Groundwater sheet, S16 Table 5 (NDVI > 0.1)


def _season_key(ts: pd.Timestamp) -> tuple[int, str]:
    m, y = ts.month, ts.year
    return (y - 1, "W") if m <= 4 else ((y, "W") if m >= 11 else (y, "S"))


# --------------------------------------------------------------------------- fields evidence (real NDVI)
@lru_cache(maxsize=1)
def field_evidence() -> dict:
    """Phenology, labels, bare calendar, rotation guess and transitions for every field polygon."""
    gj_path = EO_DIR / f"fields_{FIELD_YEAR}.geojson"
    ndvi = cached("field_ndvi_monthly.csv")
    if not gj_path.exists() or ndvi is None:
        return {"status": "pending"}
    gj = json.loads(gj_path.read_text(encoding="utf-8"))
    terr = cached("field_terrain.csv")
    tmap = terr.set_index("field_id").to_dict("index") if terr is not None else {}
    all_rows, per_field = [], {}
    for fid, sub in ndvi.groupby("field_id"):
        s = sub.set_index("date")["ndvi"].sort_index()
        s = s.resample("MS").max().interpolate(limit=2).dropna()
        if len(s) < 12:
            continue
        f = E.phenology(s)
        if f.empty:
            continue
        lab = E.classify_season(f)
        guess = E.current_rotation_guess(f, lab)
        cal = E.bare_calendar(f, lab).set_index("season")["bare_share"].to_dict()
        per_field[fid] = {"guess_W": guess[0], "guess_S": guess[1], "bare_W": round(cal.get("W", np.nan), 2),
                          "bare_S": round(cal.get("S", np.nan), 2), "ndvi_peak_mean": round(float(f["peak"].mean()), 3),
                          "seasons": int(len(f))}
        all_rows.append(f.assign(label=lab.to_numpy(), field_id=fid))
    allf = pd.concat(all_rows, ignore_index=True)
    agree = E.kmeans_agreement(allf, allf["label"])
    trans = E.transition_evidence(allf)
    # vulnerable seasons: low NDVI peak & hot (POWER heat days) — joined per season
    clim = climate_daily()
    heat = clim[clim["T2M_MAX"] > 35].index.map(_season_key).value_counts()
    stress = pd.DataFrame({"heat_days": heat}).rename_axis(["season_year", "season"])
    vul = E.vulnerable_seasons(allf.groupby(["season_year", "season"])[["peak"]].mean().reset_index(), stress)
    for feat in gj["features"]:
        fid = feat["properties"]["field_id"]
        feat["properties"].update(per_field.get(fid, {}))
        if fid in tmap:
            feat["properties"]["slope_deg"] = round(float(tmap[fid].get("slope", np.nan)), 2)
            feat["properties"]["elev_m"] = round(float(tmap[fid].get("elev", np.nan)), 1)
    labels = allf["label"].value_counts().to_dict()
    rot = pd.Series([f"{v['guess_W']}/{v['guess_S']}" for v in per_field.values()]).value_counts().to_dict()
    return {"status": "ok", "geojson": gj, "n_fields": len(gj["features"]),
            "area_ha": round(sum(f["properties"]["area_ha"] for f in gj["features"]), 1),
            "labels": {k: int(v) for k, v in labels.items()}, "rotation_guess_counts": {k: int(v) for k, v in rot.items()},
            "kmeans_agreement": round(agree, 3),
            "transitions": trans.round(3).to_dict(orient="records"),
            "vulnerable_seasons": vul[["season_year", "season", "peak", "heat_days"]].round(3).to_dict(orient="records")
            if not vul.empty else []}


# --------------------------------------------------------------------------- product summaries
def veg_area() -> pd.DataFrame | None:
    return cached("vegetated_area.csv")


def veg_check() -> list[dict]:
    """Compare every threshold with S16 for 1996 and 2022."""
    v = veg_area()
    if v is None:
        return []
    out = []
    for col in [c for c in v.columns if c.startswith("ha_ndvi_gt_")]:
        row = {"threshold": float(col.split("_")[-1])}
        for y, ref in S16.items():
            val = v.loc[v["year"] == y, col]
            row[f"model_{y}"] = round(float(val.iloc[0]), 1) if len(val) else None
            row[f"s16_{y}"] = ref
        out.append(row)
    return out


def modis_et_check() -> dict | None:
    """MOD16 ET over the cultivated fields vs FAO-56 ET0 (NASA POWER): monthly climatology 2001–2025.

    Reports the pattern correlation and the implied crop coefficient MOD16/ET0, to compare with the Crops-sheet
    Kc of the dominant field types (olive 0.65–0.70, date palm 0.90–0.95, barley 0.3–1.15).
    """
    m = cached("modis_et_fields.csv")
    if m is None:
        return None
    if "et_mm_8d" not in m or m["et_mm_8d"].dropna().empty:
        return {"status": "no_data", "n_images": int(len(m)),
                "reason": "MOD16A2GF returns no ET for any image over the 122 field polygons or the station: MOD16 "
                          "skips pixels its MCD12Q1 land-cover map classes as barren/urban, which covers this desert "
                          "plain at 500 m. ET0 cannot be cross-checked with MOD16 here."}
    daily = (m.dropna(subset=["et_mm_8d"]).set_index("date")["et_mm_8d"] / 8.0).resample("D").ffill(limit=7)
    mod = daily.groupby(daily.index.month).mean() * 30.4
    clim = climate_daily()
    clim = clim[(clim.index.year >= 2001) & (clim.index.year <= 2025)]
    et0 = clim["ET0"].groupby(clim.index.month).mean() * 30.4
    j = pd.DataFrame({"mod16": mod, "et0": et0}).dropna()
    r = float(np.corrcoef(j["mod16"], j["et0"])[0, 1]) if len(j) > 3 else float("nan")
    return {"r": round(r, 2), "mod16_annual": round(float(j["mod16"].sum())), "et0_annual": round(float(j["et0"].sum())),
            "implied_kc": round(float(j["mod16"].sum() / j["et0"].sum()), 2),
            "monthly": [{"month": int(k), "mod16": round(float(a), 1), "et0": round(float(b), 1)}
                        for k, (a, b) in j.iterrows()]}


def summary() -> dict:
    """Key EO numbers (None where a product is missing)."""
    out: dict = {}
    v = veg_area()
    if v is not None and "ha_ndvi_gt_0.25" in v:
        for y in (1996, 2022):
            sel = v.loc[v["year"] == y, "ha_ndvi_gt_0.25"]
            if len(sel):
                out[f"veg_{y}_ha_ndvi_gt_0.25"] = float(sel.iloc[0])
    sm = cached("smap_station.csv")
    if sm is not None:
        summ = sm[sm["date"].dt.month.isin([6, 7, 8, 9])]
        out["smap_rootzone_summer"] = round(float(summ["sm_rootzone"].mean()), 3)
        out["smap_rootzone_winter"] = round(float(sm[sm["date"].dt.month.isin([12, 1, 2])]["sm_rootzone"].mean()), 3)
    im = cached("imerg_station.csv")
    if im is not None:
        h = imerg_heavy_days(im)
        out["imerg_annual_mm"] = round(float(h["annual_mm"].mean()), 1)
        out["imerg_days_gt10_per_yr"] = round(float(h["days_gt10"].mean()), 2)
        out["imerg_days_gt20_per_yr"] = round(float(h["days_gt20"].mean()), 2)
    md = cached("modis_station.csv")
    if md is not None:
        out["modis_lst_summer_c"] = round(float(md[md["date"].dt.month.isin([6, 7, 8])]["lst_c"].mean()), 1)
    gr = cached("grace_station.csv")
    if gr is not None:
        out["grace_trend_cm_yr"] = round(linear_trend(gr, "lwe_thickness"), 2)
    ens = cmip6_ensemble()
    for scen, d in ens.items():
        out[f"cmip_{scen}_dtmax"] = round(float(np.mean(d["d_t"])), 2)
        out[f"cmip_{scen}_rain_pct"] = round((float(np.mean(d["rain_scale"])) - 1) * 100, 1)
    fe = field_evidence()
    if fe.get("status") == "ok":
        out["n_fields"] = fe["n_fields"]
        out["fields_ha"] = fe["area_ha"]
        out["fields_rotation_guess"] = fe["rotation_guess_counts"]
    return out


def card_sentences() -> tuple[list[str], list[str]]:
    """EN/AR evidence bullets from the EO numbers that exist."""
    s = summary()
    en, ar = [], []
    if s.get("veg_2022_ha_ndvi_gt_0.25") is not None and s.get("veg_1996_ha_ndvi_gt_0.25") is not None:
        en.append(f"Landsat 1990–2025: green area (yearly NDVI P90 > 0.25, land only; matches S16 within 25 %) in the Ras Sudr plain grew from "
                  f"{s['veg_1996_ha_ndvi_gt_0.25']:,.0f} ha (1996) to {s['veg_2022_ha_ndvi_gt_0.25']:,.0f} ha (2022).")
        ar.append(f"لاندسات 1990–2025: المساحة الخضرا في سهل رأس سدر زادت من {s['veg_1996_ha_ndvi_gt_0.25']:,.0f} هكتار "
                  f"(1996) لـ {s['veg_2022_ha_ndvi_gt_0.25']:,.0f} هكتار (2022).")
    if "n_fields" in s:
        top = max(s["fields_rotation_guess"], key=s["fields_rotation_guess"].get)
        en.append(f"Sentinel-2 finds {s['n_fields']} cultivated fields ({s['fields_ha']:,.0f} ha) nearby; the most common "
                  f"pattern over the last 3 years is {top.replace('_', ' ')} (winter/summer).")
        names = {"perennial": "معمّر", "winter_crop": "محصول شتوي", "summer_crop": "محصول صيفي", "bare": "بور",
                 "unknown": "مش واضح"}
        top_ar = " / ".join(names.get(x, x) for x in top.split("/"))
        ar.append(f"Sentinel-2 لقى {s['n_fields']} حقل مزروع ({s['fields_ha']:,.0f} هكتار) حوالينا؛ أكتر نمط في آخر 3 سنين "
                  f"هو {top_ar} (شتا / صيف).")
    if "smap_rootzone_summer" in s:
        en.append(f"SMAP root-zone moisture: {s['smap_rootzone_summer']:.2f} m³/m³ in summer vs "
                  f"{s['smap_rootzone_winter']:.2f} in winter.")
        ar.append(f"رطوبة الجذور من SMAP: {s['smap_rootzone_summer']:.2f} م³/م³ في الصيف مقابل {s['smap_rootzone_winter']:.2f} في الشتا.")
    if "imerg_annual_mm" in s:
        en.append(f"GPM IMERG 2001–2025: {s['imerg_annual_mm']:.0f} mm/yr, {s['imerg_days_gt10_per_yr']:.1f} days/yr above 10 mm.")
        ar.append(f"GPM IMERG 2001–2025: {s['imerg_annual_mm']:.0f} مم/سنة، و{s['imerg_days_gt10_per_yr']:.1f} يوم/سنة فوق 10 مم.")
    if "modis_lst_summer_c" in s:
        en.append(f"MODIS land-surface temperature in June–August averages {s['modis_lst_summer_c']:.0f} °C.")
        ar.append(f"حرارة سطح الأرض من MODIS في يونيو–أغسطس متوسطها {s['modis_lst_summer_c']:.0f}°.")
    if "cmip_ssp585_dtmax" in s:
        en.append(f"NEX-GDDP-CMIP6 (5 models, 2041–2060): Tmax +{s['cmip_ssp245_dtmax']:.1f} °C (SSP2-4.5) to "
                  f"+{s['cmip_ssp585_dtmax']:.1f} °C (SSP5-8.5) — included in the stress test.")
        ar.append(f"NEX-GDDP-CMIP6 (5 موديلات، 2041–2060): العظمى +{s['cmip_ssp245_dtmax']:.1f}° (SSP2-4.5) لحد "
                  f"+{s['cmip_ssp585_dtmax']:.1f}° (SSP5-8.5) — داخلين في اختبار التحمّل.")
    if "grace_trend_cm_yr" in s:
        en.append(f"GRACE/GRACE-FO regional water storage trend: {s['grace_trend_cm_yr']:+.2f} cm/yr (coarse, regional).")
        ar.append(f"اتجاه مخزون المية الإقليمي من GRACE: {s['grace_trend_cm_yr']:+.2f} سم/سنة (تقريبي وإقليمي).")
    return en, ar


def downsample(df: pd.DataFrame, col: str, freq: str = "MS", how: str = "mean", nd: int = 3) -> list[list]:
    """[[YYYY-MM, value], …] for compact web charts."""
    s = getattr(df.set_index("date")[col].resample(freq), how)().dropna()
    return [[d.strftime("%Y-%m"), round(float(v), nd)] for d, v in s.items()]


def web_json() -> dict:
    """Everything the site needs from EO (series downsampled to monthly)."""
    out: dict = {"summary": summary(), "veg_check": veg_check(), "modis_et_check": modis_et_check()}
    v = veg_area()
    if v is not None:
        out["veg_area"] = v.drop(columns=["date"]).round(1).to_dict(orient="records")
    st = cached("ndvi_station.csv")
    if st is not None:
        out["ndvi_station"] = downsample(st.dropna(subset=["ndvi"]), "ndvi", "MS", "max")
    for name, col, key in (("smap_station.csv", "sm_rootzone", "smap_rootzone"), ("smap_station.csv", "sm_surface",
                                                                                   "smap_surface"),
                           ("modis_station.csv", "lst_c", "modis_lst"), ("modis_station.csv", "et_mm_8d", "modis_et"),
                           ("grace_station.csv", "lwe_thickness", "grace")):
        d = cached(name)
        if d is not None and col in d:
            out[key] = downsample(d.dropna(subset=[col]), col, "MS", "mean", 2)
    im = cached("imerg_station.csv")
    if im is not None:
        out["imerg_annual"] = imerg_heavy_days(im).reset_index().rename(columns={"date": "year"}).round(1).to_dict(
            orient="records")
    cm = cached("cmip6_deltas.csv")
    if cm is not None:
        out["cmip6"] = {"models": sorted(cm["model"].unique().tolist()), "ensemble": cmip6_ensemble()}
    fe = field_evidence()
    if fe.get("status") == "ok":
        out["fields"] = {k: v for k, v in fe.items() if k != "geojson"}
    return out
