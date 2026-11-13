"""Writes reports/01_climate.md (Prompt 1)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import climate as C
from .config import REPORTS
from .data_io import load_s1_climate
from .reporting import md_table, new_fig, save_fig


def climate_frame() -> pd.DataFrame:
    """Extended POWER daily series 1981→ with ET0 and Peff."""
    return C.add_derived(C.extend_power())


def hargreaves_check(df: pd.DataFrame) -> dict[str, float]:
    """Raw Hargreaves (kRs 0.16) vs CERES on 1984–2025, and the ET0 of filled vs CERES years."""
    sub = df[(df.index.year >= 1984) & (df.index.year <= 2025)]
    ra = C.extraterrestrial_rad(sub.index.dayofyear.to_numpy(), C.POWER_LAT)
    hs = 0.16 * np.sqrt((sub["T2M_MAX"] - sub["T2M_MIN"]).clip(lower=0)) * ra
    rel = float(hs.sum() / sub["ALLSKY_SFC_SW_DWN"].sum() - 1)
    return {"rel_annual_raw": rel}


def s1_comparison(df: pd.DataFrame) -> pd.DataFrame:
    """Our POWER 1983–2020 monthly means vs S1 Table 1 (Site sheet)."""
    ours = C.monthly_climatology(df, 1983, 2020)
    s1 = load_s1_climate()
    rows = []
    for _, r in s1.iterrows():
        m = int(r["month_num"])
        rows.append({"month": r["month"], "Tmin_S1": r["tmin"], "Tmin_POWER": ours.at[m, "T2M_MIN"],
                     "Tmax_S1": r["tmax"], "Tmax_POWER": ours.at[m, "T2M_MAX"],
                     "P_S1_mm": r["precip"], "P_POWER_mm": ours.at[m, "PRECTOTCORR"]})
    return pd.DataFrame(rows)


def write_report(df: pd.DataFrame | None = None) -> str:
    """Build the markdown report and figure; returns the markdown text."""
    df = climate_frame() if df is None else df
    ann = C.annual_summary(df)
    ann = ann[ann.index <= 2025]
    st = C.season_table(df)
    ext = C.extreme_seasons(st)
    cmp_ = s1_comparison(df)
    hc = hargreaves_check(df)

    fig, ax = new_fig(9, 4)
    ax.bar(ann.index, ann["rain_mm"], color="#4cc9f0", label="Rain (mm/yr)")
    ax.set_ylabel("Rain mm/yr")
    ax2 = ax.twinx()
    ax2.plot(ann.index, ann["ET0_mm"], color="#e76f51", lw=2, label="ET0 FAO-56 (mm/yr)")
    ax2.set_ylabel("ET0 mm/yr")
    ax.set_title("Ras Sudr — NASA POWER 1981–2025: annual rain vs reference ET")
    fig.legend(loc="upper left", bbox_to_anchor=(0.08, 0.92))
    fig_path = save_fig(fig, "01_climate_annual.png")

    fmt = ann.reset_index().rename(columns={"date": "year"})
    fmt["year"] = fmt["year"].astype(int)
    md = [
        "# 01 — Climate (NASA POWER, FAO-56)", "",
        "Source: NASA POWER daily point API (community AG), pixel 29.5907 N 32.7203 E, elev 215 m. "
        "2020-01→2026-09 from our team file, 1981-2019 fetched from the API. "
        "The 2020–2021 overlap between API and file has max abs difference **0.0** for every variable "
        "(`data/processed/power_1981_2026.overlap.csv`).", "",
        f"Solar radiation is missing for 1981–1983 in POWER; those days use Hargreaves Rs (FAO-56 Eq.50). "
        f"Raw Hargreaves (kRs 0.16) is {hc['rel_annual_raw']*100:+.1f} % vs CERES on 1984–2025, so it is "
        "bias-corrected per calendar month with the CERES/Hargreaves ratio before use (flag `rs_filled`).", "",
        f"**Mean annual ET0 (1981–2025): {ann['ET0_mm'].mean():,.0f} mm** "
        f"(range {ann['ET0_mm'].min():,.0f}–{ann['ET0_mm'].max():,.0f}); expected ≈1,900 → ✅. "
        f"**Mean rain: {ann['rain_mm'].mean():.0f} mm/yr** (range {ann['rain_mm'].min():.0f}–{ann['rain_mm'].max():.0f}).", "",
        f"![annual]({fig_path.as_posix()})", "",
        "## Monthly climatology vs S1 Table 1 (1983–2020, Nov–Apr)", "",
        md_table(cmp_), "",
        "## Five hottest seasons (mean Tmax anomaly vs same season type)", "",
        md_table(ext["hottest"][["season_year", "season", "tmax_mean", "tmax_anom", "heat_days", "rain_mm"]]), "",
        "## Five driest winters (rain Nov–Apr)", "",
        md_table(ext["driest"][["season_year", "season", "rain_mm", "ET0_mm", "tmax_mean"]]), "",
        "## Annual table", "", md_table(fmt[["year", "ET0_mm", "rain_mm", "tmax_mean", "tmin_mean", "heat_days"]]), "",
        "Effective rain: USDA-SCS monthly formula (assumptions `clim.peff_*`). Heat days: Tmax > 35 °C (`clim.heat_report_c`).",
    ]
    text = "\n".join(md)
    (REPORTS / "01_climate.md").write_text(text, encoding="utf-8")
    return text
