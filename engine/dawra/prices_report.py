"""Writes reports/prices.md from data/external/prices_research.csv and pumping_cost.csv."""
from __future__ import annotations

import pandas as pd

from . import assumptions as A
from .config import DATA, REPORTS
from .reporting import md_table


def write_report() -> str:
    """Price/cost table with sources and the pumping-cost derivation."""
    d = pd.read_csv(DATA / "external" / "prices_research.csv").fillna("")
    pump = pd.read_csv(DATA / "external" / "pumping_cost.csv").fillna("")
    tab = d[["crop_id", "product", "price_egp_per_ton", "cost_egp_per_feddan", "is_assumption", "price_basis",
             "cost_basis"]].copy()
    tab["status"] = tab["is_assumption"].map({0: "✅ sourced", 1: "⚠ estimate (see basis)"})
    n_src = int((d["price_source_url"] != "").sum())
    md = [
        "# Prices, costs and pumping (2025–2026, EGP)", "",
        f"Every row has a basis and a URL in `data/external/prices_research.csv` (sources listed in "
        f"`data/external/SOURCES_prices.md`, accessed 2026-11-13). Fully sourced rows (price and cost): "
        f"**{int((d['is_assumption'] == 0).sum())} of {len(d)}**; rows with a sourced price: **{n_src}**. "
        "Estimates are flagged `is_assumption = 1` in `data/prices_egp.csv` and on the plan cards.", "",
        md_table(tab[["crop_id", "product", "price_egp_per_ton", "cost_egp_per_feddan", "status", "price_basis",
                      "cost_basis"]], "{:,.0f}"), "",
        "## By-product: cereal straw", "",
        f"Barley, wheat and triticale also earn straw (tibn) at {A.get('econ.straw_price'):,.0f} EGP/t "
        "(Egypt Telegraph, May 2026). Straw = grain × (1 − HI)/HI with HI 0.505 for barley (S1 grain 4,215 / "
        "biological 8,348 kg/ha) and 0.40 for wheat/triticale (assumption).", "",
        "## Groundwater pumping", "",
        md_table(pump[["item", "value", "unit", "notes"]]), "",
        f"Model value: **{A.get('econ.pump_egp_m3'):.2f} EGP per m³** (diesel, 30 m total head; fuel only) "
        "charged on every m³ of irrigation. Perennial forage costs are annual and charged half per season.", "",
        "Profit = Σ seasons [(product t × price + straw t × straw price − production cost) × planted feddan − "
        "pumping m³ × EGP/m³]. Production cost excludes land rent (owner-operated family farm, F001).",
    ]
    text = "\n".join(md)
    (REPORTS / "prices.md").write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    write_report()
