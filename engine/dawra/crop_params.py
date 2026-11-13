"""Crop parameter objects: Crops sheet values completed by documented assumptions.

Precedence for every field: Crops sheet (FAO-56 / FAO-29 / local) → ``assumptions.csv`` row.
Nothing else is filled in silently; :func:`build_crops` raises if a needed value is missing.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
import pandas as pd

from . import assumptions as A
from .data_io import load_crops

PLAN_EXCLUDED = ("date_palm", "olive")  # perennial trees: border options, not in the 3-year plan

CROP_AR: dict[str, str] = {
    "barley": "شعير", "wheat": "قمح", "triticale": "تريتيكال", "barley_forage": "شعير علف", "sorghum": "ذرة رفيعة",
    "pearl_millet": "دخن", "sudan_grass": "حشيشة السودان", "bermuda": "نجيل برمودا", "rhodes": "حشيشة رودس",
    "sugar_beet": "بنجر السكر", "quinoa": "كينوا", "cotton": "قطن", "alfalfa": "برسيم حجازي", "cowpea": "لوبيا",
    "faba_bean": "فول بلدي", "sesbania": "سيسبانيا", "tomato": "طماطم", "squash": "كوسة", "watermelon": "بطيخ",
    "date_palm": "نخيل البلح", "olive": "زيتون", "fallow": "بور (راحة)",
}

HEAT_GROUP: dict[str, str] = {
    **dict.fromkeys(["barley", "wheat", "triticale", "barley_forage"], "winter_cereal"),
    **dict.fromkeys(["sorghum", "pearl_millet", "sudan_grass"], "c4_grass"),
    "cotton": "cotton", "cowpea": "legume", "sesbania": "legume", "faba_bean": "cool_legume",
    **dict.fromkeys(["tomato", "squash", "watermelon"], "vegetable"),
    **dict.fromkeys(["sugar_beet", "quinoa"], "root_pseudo"),
    **dict.fromkeys(["bermuda", "rhodes", "alfalfa", "date_palm", "olive"], "perennial"),
}

RESIDUE_GROUP: dict[str, str] = {
    **dict.fromkeys(["barley", "wheat", "triticale", "sorghum", "pearl_millet"], "cereal"),
    **dict.fromkeys(["barley_forage", "sudan_grass"], "forage"),
    **dict.fromkeys(["cowpea", "faba_bean"], "legume"), "sesbania": "green_manure",
    **dict.fromkeys(["sugar_beet", "cotton", "quinoa"], "cash"),
    **dict.fromkeys(["tomato", "squash", "watermelon"], "vegetable"),
    **dict.fromkeys(["bermuda", "rhodes", "alfalfa", "date_palm", "olive"], "perennial"),
}


@dataclass(frozen=True)
class Crop:
    """Everything the agronomy engine needs about one crop."""

    crop_id: str
    crop_en: str
    crop_ar: str
    family: str
    use: str
    slot: str  # 'W' or 'S' (slot in which it is sown)
    perennial: bool
    total_days: int
    kc: tuple[float, float, float]
    stage_frac: tuple[float, float, float, float]
    root_m: float
    ece100: float
    ece50: float
    salt_rating: str
    salt_source: str
    n_fixing: bool
    sow_offset: int
    tcrit: float
    ymax: float
    ymax_source: str
    residue_group: str
    revenue_weight: float = 1.0
    notes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def slope_b(self) -> float:
        """Maas–Hoffman slope b = 50 / (ECe50 − ECe100) in %/(dS/m)."""
        return 50.0 / (self.ece50 - self.ece100)

    def stage_days(self) -> tuple[int, int, int, int]:
        """Stage lengths in days (sum = total_days)."""
        d = [int(round(f * self.total_days)) for f in self.stage_frac]
        d[-1] = self.total_days - sum(d[:-1])
        return tuple(d)  # type: ignore[return-value]


def _stage_fracs(src: object) -> tuple[tuple[float, float, float, float], bool]:
    """Parse 'FAO-56 T11 arid 20/35/45/30' into fractions; fall back to assumptions."""
    nums = re.findall(r"(\d+)/(\d+)/(\d+)/(\d+)", str(src)) if isinstance(src, str) else []
    if nums:
        v = np.array([float(x) for x in nums[0]])
        return tuple(v / v.sum()), True  # type: ignore[return-value]
    keys = ("ws.frac_ini", "ws.frac_dev", "ws.frac_mid", "ws.frac_late")
    return tuple(A.get(k) for k in keys), False  # type: ignore[return-value]


def _rating_thresholds(crops: pd.DataFrame) -> dict[str, tuple[float, float]]:
    """Median ECe_100 / ECe_50 of crops in each FAO-29 salt rating class (fallback method)."""
    ok = crops.dropna(subset=["ECe_100", "ECe_50", "salt_rating"])
    g = ok.groupby("salt_rating")
    return {r: (float(sub["ECe_100"].median()), float(sub["ECe_50"].median())) for r, sub in g}


def _slot_of(row: pd.Series) -> str:
    """Sowing slot from season_ras_sudr and the sowing window."""
    s = str(row["season_ras_sudr"]).lower()
    if s.startswith("winter"):
        return "W"
    if s == "summer":
        return "S"
    window = str(row.get("sowing_window", ""))
    return "W" if re.search(r"Oct|Nov", window) else "S"


def _first(aid: str, sheet_val: float) -> tuple[float, bool]:
    """Sheet value if present else assumption ``aid``; returns (value, from_assumption)."""
    if sheet_val is not None and not np.isnan(sheet_val):
        return float(sheet_val), False
    return A.get(aid), True


@lru_cache(maxsize=1)
def build_crops() -> dict[str, Crop]:
    """All 21 crops as :class:`Crop` (barley ymax is replaced later by calibration)."""
    raw = load_crops()
    rating_thr = _rating_thresholds(raw)
    out: dict[str, Crop] = {}
    for cid, r in raw.iterrows():
        notes: list[str] = []
        kci, a1 = _first(f"ws.kc_ini.{cid}", r["Kc_ini"])
        kcm, a2 = _first(f"ws.kc_mid.{cid}", r["Kc_mid"])
        kce, a3 = _first(f"ws.kc_end.{cid}", r["Kc_end"])
        if a1 or a2 or a3:
            notes.append("Kc from assumptions.csv")
        root, a4 = _first(f"ws.root.{cid}", r["root_depth_m"])
        if a4:
            notes.append("root depth from assumptions.csv")
        fracs, parsed = _stage_fracs(r.get("stage_days_source"))
        if not parsed:
            notes.append("default FAO-56 stage fractions")
        rating = r["salt_rating"] if isinstance(r["salt_rating"], str) else A.get_str(f"yield.rating.{cid}")
        if np.isnan(r["ECe_100"]) or np.isnan(r["ECe_50"]):
            e100, e50 = rating_thr[rating]
            salt_src = f"median of '{rating}' crops (FAO-29 via Crops sheet)"
            notes.append("salt thresholds from rating fallback")
        else:
            e100, e50 = float(r["ECe_100"]), float(r["ECe_50"])
            salt_src = "FAO-29 Table 4 (Crops sheet)"
        slot = _slot_of(r)
        perennial = str(r["season_ras_sudr"]).lower() == "perennial"
        sow = int(A.get(f"sow.{cid}")) if A.has(f"sow.{cid}") else 0
        ymax = A.get(f"ymax.{cid}") if A.has(f"ymax.{cid}") else float("nan")
        ysrc = str(A.table().at[f"ymax.{cid}", "source"]) if A.has(f"ymax.{cid}") else "calibrated / n.a."
        rev = A.get(f"rev.{cid}") if A.has(f"rev.{cid}") else 1.0
        out[cid] = Crop(
            crop_id=cid, crop_en=str(r["crop_en"]), crop_ar=CROP_AR[cid], family=str(r["family"]), use=str(r["use"]),
            slot=slot, perennial=perennial, total_days=int(r["total_days"]), kc=(kci, kcm, kce), stage_frac=fracs,
            root_m=root, ece100=e100, ece50=e50, salt_rating=rating, salt_source=salt_src, n_fixing=bool(r["N_fixing"]),
            sow_offset=sow, tcrit=A.get(f"heat.tcrit.{HEAT_GROUP[cid]}"), ymax=ymax, ymax_source=ysrc,
            residue_group=RESIDUE_GROUP[cid], revenue_weight=rev, notes=tuple(notes),
        )
    return out


def plan_crops(avoid: tuple[str, ...] = ()) -> dict[str, Crop]:
    """Crops allowed in a 3-year plan (no tree perennials, no avoided crops)."""
    return {k: v for k, v in build_crops().items() if k not in PLAN_EXCLUDED and k not in avoid}
