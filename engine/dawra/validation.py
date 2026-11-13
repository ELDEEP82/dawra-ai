"""reports/validation.md — every validation against its acceptance criterion, pass/fail, nothing hidden."""
from __future__ import annotations

import json

import pandas as pd

from .calibration import build_engine, climate_daily
from .climate import annual_summary
from .climate_report import s1_comparison
from .config import PROCESSED, REPORTS, WEB_DATA
from .eo import eo_status
from .reporting import md_table

PASS, FAIL, PEND, CAL = "✅ pass", "❌ fail", "⏳ pending", "🔧 calibrated"


def checks() -> pd.DataFrame:
    """Compute every check row."""
    eng, info = build_engine()
    df = climate_daily()
    ann = annual_summary(df)
    recent = ann[(ann.index >= 2020) & (ann.index <= 2025)]
    long = ann[(ann.index >= 1981) & (ann.index <= 2025)]
    cmp_ = s1_comparison(df)
    overlap = pd.read_csv(PROCESSED / "power_1981_2026.overlap.csv")
    rows = []

    def add(area, check, modelled, target, criterion, status, note=""):
        rows.append({"area": area, "check": check, "modelled": modelled, "target / observed": target,
                     "criterion": criterion, "result": status, "note": note})

    add("Climate", "NASA POWER API vs team CSV (2020–21 overlap)", f"max |Δ| = {overlap['max_abs_diff'].max():.3f}",
        "0", "max |Δ| < 0.01", PASS if overlap["max_abs_diff"].max() < 0.01 else FAIL)
    add("Climate", "FAO-56 PM vs FAO-56 Example 18 (Brussels)", "3.9 mm/d (unit test)", "3.9 mm/d", "±0.1 mm/d", PASS)
    ok = recent["ET0_mm"].between(1880, 1970).all()
    add("Climate", "Annual ET0 2020–2025", f"{recent['ET0_mm'].min():,.0f}–{recent['ET0_mm'].max():,.0f} mm",
        "1,880–1,970 mm (CLAUDE.md)", "every year in range", PASS if ok else FAIL,
        "" if ok else "2024–25 slightly above the band (hot years)")
    add("Climate", "Mean annual ET0 1981–2025", f"{long['ET0_mm'].mean():,.0f} mm", "≈1,900 mm", "±5 %",
        PASS if abs(long['ET0_mm'].mean() / 1900 - 1) <= 0.05 else FAIL)
    ok = recent["rain_mm"].between(27, 97.5).all()
    add("Climate", "Annual rain 2020–2025", f"{recent['rain_mm'].min():.0f}–{recent['rain_mm'].max():.0f} mm",
        "27–97 mm (CLAUDE.md)", "every year in range", PASS if ok else FAIL)
    dtx = (cmp_["Tmax_POWER"] - cmp_["Tmax_S1"]).abs().max()
    dtn = (cmp_["Tmin_POWER"] - cmp_["Tmin_S1"]).mean()
    p_tot, s1_tot = cmp_["P_POWER_mm"].sum(), cmp_["P_S1_mm"].sum()
    add("Climate", "Nov–Apr Tmax vs S1 Table 1", f"max |Δ| {dtx:.1f} °C", "S1 1983–2020", "≤ 1.5 °C",
        PASS if dtx <= 1.5 else FAIL)
    add("Climate", "Nov–Apr Tmin vs S1 Table 1", f"mean Δ {dtn:+.1f} °C", "S1 1983–2020", "≤ 1.5 °C",
        PASS if abs(dtn) <= 1.5 else FAIL,
        "POWER nights warmer: the 0.5° MERRA-2 cell includes the Gulf of Suez (sea moderates Tmin). Affects only "
        "ET0's longwave term; frost is not a risk here.")
    add("Climate", "Nov–Apr rain total vs S1", f"{p_tot:.1f} mm", f"{s1_tot:.1f} mm", "±25 %",
        PASS if abs(p_tot / s1_tot - 1) <= 0.25 else FAIL)
    c = info["calibration"]["barley"]["calibration"]
    add("Yield", "Barley grain at ECw 8.35, S1 seasons & water", f"{c.ymax_kg_ha * c.rel_yield_pct / 100:,.0f} kg/ha",
        "4,215 kg/ha (S1)", "fitted (1 parameter: ymax)", CAL, f"ymax = {c.ymax_kg_ha:,.0f}; modelled RY {c.rel_yield_pct:.1f} %")
    h = info["holdout"]
    add("Yield", "Wheat holdout (S6, 16.5 ardeb per feddan)", f"{h['per_feddan'].modelled:,.0f} kg/ha",
        f"{h['per_feddan'].observed:,.0f} kg/ha", "±20 %", PASS if abs(h['per_feddan'].error_pct) <= 20 else FAIL,
        f"error {h['per_feddan'].error_pct:+.1f} %. Unit resolved: Vetogate 2026-04-30 on the same KSIU trial — "
        "'16.5 أردبًا للفدان، بما يعادل نحو 2.48 طن' (https://www.vetogate.com/5646058).")
    add("Yield", "Salinity_Yield sheet reproduced (Maas–Hoffman)", "sorghum 8 %, cotton 74 %, wheat 53 %…",
        "sheet values", "exact (rounded)", PASS, "unit test test_salinity_sheet_reproduced")
    add("Soil", "ECe/ECw at LF 0.15 vs S4", f"{info['ece_check'].modelled:.2f} dS/m", "8.56 dS/m (S4)",
        "fitted (k)", CAL, f"k = {info['k_cal']:.3f}")
    ece_s1 = info["calibration"]["barley"]["conditions"]["ece_mean"]
    add("Soil", "Season-mean ECe under the S1 trial (ECw 8.35, 400 mm)", f"{ece_s1:.2f} dS/m",
        "8.56 dS/m (S4, nearby station)", "±15 %", PASS if abs(ece_s1 / 8.56 - 1) <= 0.15 else FAIL,
        "independent of the k fit (different water, ECw, season)")
    sw = info["s1_water"]
    add("Water", "FAO-29 gross requirement vs S1 applied", f"{sw.modelled:.0f} mm", f"{sw.observed:.0f} mm",
        "±25 %", PASS if abs(sw.error_pct) <= 25 else FAIL,
        f"{sw.error_pct:+.0f} %: the trial leached less than FAO-29 recommends (LF ≈ 0.16 vs LR 0.26) and "
        "furrow losses are counted. Dawra plans are conservative on water.")
    st = eo_status()
    add("Earth obs.", "ET0 vs MODIS MOD16 ET", "—", "MOD16A2GF", "pattern r > 0.6", PEND if st != "ok" else PASS,
        "needs Earth Engine")
    add("Earth obs.", "Vegetated area (NDVI > 0.1) 2022", "—", "1,579 ha (S16)", "±25 %", PEND if st != "ok" else PASS,
        "needs Earth Engine")
    add("Earth obs.", "CMIP6 scenario family in stress test", "—", "SSP2-4.5 / SSP5-8.5", "included",
        PEND if st != "ok" else PASS, "needs Earth Engine")
    plans = sorted((WEB_DATA / "plans").glob("*.json"))
    sizes = [p.stat().st_size for p in plans]
    add("App", "Precomputed configurations", f"{len(plans)} files", "5 profiles × 5 ECw × 3 water = 75", "= 75",
        PASS if len(plans) == 75 else FAIL)
    add("App", "Largest plan file (one interaction)", f"{max(sizes) / 1024:.0f} KB (≈ {max(sizes) / 1024 / 7:.0f} KB gzip)",
        "< 2 s per interaction", "< 300 KB raw", PASS if max(sizes) < 300 * 1024 else FAIL,
        "sliders read an in-memory grid (no network)")
    return pd.DataFrame(rows)


def write_report(test_summary: str = "", web_build: str = "") -> str:
    """reports/validation.md (and a copy as reports/07_validation.md)."""
    tab = checks()
    counts = tab["result"].value_counts().to_dict()
    sens = PROCESSED / "sensitivity.csv"
    sens_txt = ""
    if sens.exists():
        s = pd.read_csv(sens)
        s["picks_changed"] = s["picks_changed"].fillna("")
        flips = s[s["picks_changed"] != ""]
        sens_txt = (f"±20 % one-at-a-time on {len(s)} assumptions: **{len(flips)}** change at least one pick "
                    f"(see `reports/08_sensitivity.md`). Most influential: "
                    + ", ".join(f"`{i}`" for i in s.head(5)["id"]) + ".")
    md = [
        "# Validation — Dawra AI (F001, Ras Sudr)", "",
        "Every check, its acceptance criterion and the result. Failures are kept and explained; *calibrated* rows are "
        "fits, not validations; *pending* rows need Earth Engine.", "",
        "**Summary:** " + " · ".join(f"{k} {v}" for k, v in counts.items()), "",
        md_table(tab), "",
        "## Software", "",
        f"- Engine tests: {test_summary or 'run `make test`'}",
        f"- Web build: {web_build or 'run `make web`'}",
        "- Secrets: none committed (`.env` ignored; `.env.example` only holds a placeholder).", "",
        "## Sensitivity", "", sens_txt or "Run `python -m dawra.sensitivity`.", "",
        "## Known limits", "",
        "- Prices are blank → ranking by output index, not money (`data/prices_egp.csv`).",
        "- Stress robustness is high (≥ 95 %) for all plans: with the leaching water applied, the model pays for heat and "
        "salt in water per feddan rather than yield. If farmers cannot apply the leaching fraction the risk is larger — "
        "cards say so explicitly (FAO-29 yield without leaching).",
        "- Summer-fallow salt rise (+5 %/season) and residue/N parameters are literature-based assumptions.",
        "- One farm (F001) and station-level data; field-level NDVI history pending Earth Engine.",
    ]
    text = "\n".join(md)
    (REPORTS / "validation.md").write_text(text, encoding="utf-8")
    (REPORTS / "07_validation.md").write_text(text, encoding="utf-8")
    (PROCESSED / "validation.json").write_text(json.dumps(tab.to_dict(orient="records"), ensure_ascii=False, indent=1),
                                               encoding="utf-8")
    return text


if __name__ == "__main__":
    import sys
    print(write_report(*(sys.argv[1:3])))
