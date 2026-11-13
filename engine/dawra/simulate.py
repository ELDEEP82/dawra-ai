"""Plan simulator — chains M2 (water & salt), M3 (yield) and M4 (soil twin) over 6 seasons.

A plan is a tuple of 6 crop ids (``'fallow'`` allowed). A perennial appears in two
consecutive slots (its sowing slot, then its continuation). Simulation runs either in
*typical* mode (climatology means, scalars) or *scenario* mode (vectorised over an
array of season-years per slot).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import assumptions as A
from .config import HA_PER_FEDDAN, SLOTS
from .crop_params import Crop
from .soil_twin import SoilState, ece_steady, mix_ece, soil_health_index, step
from .water_salt import (SeasonBank, drainage_mm, efficiency, gross_irrigation, leaching_requirement,
                         mm_to_m3_per_feddan)
from .yield_model import heat_factor, salt_rel_yield

FALLOW = "fallow"
SLOT_TYPE = tuple(s[0] for s in SLOTS)  # W S W S W S
SLOT_START_DAY = (0, 181, 365, 546, 730, 911)  # days from W1 start (1 Nov) to each slot start
CYCLE_DAYS = 1095


@dataclass(frozen=True)
class Farm:
    """Farm inputs (Farmer_Priorities profile + Soil_Baseline)."""

    farm_id: str
    area_fdn: float
    ecw: float
    water_m3_day: float
    system: str
    livestock: int
    preferred: tuple[str, ...]
    avoid: tuple[str, ...]
    last_crop: str
    ece0: float
    soc0: float
    n0: float
    theta_fc: float

    def with_(self, **kw) -> "Farm":
        """Copy with changed fields."""
        d = self.__dict__.copy()
        d.update(kw)
        return Farm(**d)


class BankArrays:
    """Fast year-indexed numpy view of a :class:`SeasonBank`."""

    COLS = ("etc", "peff", "peak_net", "hot_mid")

    def __init__(self, bank: SeasonBank, y0: int, y1: int):
        self.arr: dict[tuple[str, int], dict[str, np.ndarray]] = {}
        self.year0: dict[tuple[str, int], int] = {}
        self.typ: dict[tuple[str, int], dict[str, float]] = {}
        for key, df in bank.data.items():
            if df.empty:
                continue
            full = df.reindex(range(int(df.index.min()), int(df.index.max()) + 1))
            self.year0[key] = int(df.index.min())
            self.arr[key] = {c: full[c].to_numpy(dtype=float) for c in self.COLS}
            sub = df[(df.index >= y0) & (df.index <= y1)]
            self.typ[key] = {c: float(sub[c].mean()) for c in self.COLS}

    def gather(self, key: tuple[str, int], years: np.ndarray, col: str) -> np.ndarray:
        """Values of ``col`` for each season-year in ``years`` (NaN outside the record)."""
        a = self.arr[key][col]
        i = np.asarray(years, dtype=int) - self.year0[key]
        ok = (i >= 0) & (i < len(a))
        out = np.full(i.shape, np.nan)
        out[ok] = a[i[ok]]
        return out

    def years_available(self, key: tuple[str, int]) -> np.ndarray:
        """Season-years with complete data for ``key``."""
        a = self.arr[key]["etc"]
        return self.year0[key] + np.flatnonzero(~np.isnan(a))


@dataclass
class SlotResult:
    """Per-slot outputs (arrays in scenario mode, 0-d in typical mode)."""

    slot: str
    crop_id: str
    part: int
    area_fdn: float
    water_mm: np.ndarray
    water_m3: np.ndarray
    lr: float
    salt_ry: np.ndarray
    heat_f: np.ndarray
    rel_yield_pct: np.ndarray
    yield_kg_ha: np.ndarray
    ece_mean: np.ndarray
    etc_mm: np.ndarray


@dataclass
class SimResult:
    """Outputs of one plan simulation."""

    plan: tuple[str, ...]
    slots: list[SlotResult]
    water_m3: np.ndarray
    productivity: np.ndarray
    profit_egp: np.ndarray | None
    soil_index: np.ndarray
    start: SoilState
    trajectory: list[SoilState] = field(default_factory=list)

    @property
    def end(self) -> SoilState:
        """Soil state after the 6th season."""
        return self.trajectory[-1]


# --------------------------------------------------------------------------- plan structure
def parts_of(plan: tuple[str, ...], crops: dict[str, Crop]) -> list[tuple[str, int]]:
    """(crop_id, part) per slot; a perennial's second consecutive slot is part 1."""
    out: list[tuple[str, int]] = []
    for i, cid in enumerate(plan):
        if cid != FALLOW and crops[cid].perennial and i > 0 and out[i - 1] == (cid, 0):
            out.append((cid, 1))
        else:
            out.append((cid, 0))
    return out


def structure_violations(plan: tuple[str, ...], crops: dict[str, Crop]) -> dict[str, float]:
    """Constraint terms (0 = satisfied): wrong slot, broken perennial, overlaps, family runs."""
    parts = parts_of(plan, crops)
    wrong_slot = broken = 0
    for i, (cid, p) in enumerate(parts):
        if cid == FALLOW:
            continue
        c = crops[cid]
        if p == 0 and c.slot != SLOT_TYPE[i]:
            wrong_slot += 1
        if c.perennial and p == 0 and (i == 5 or parts[i + 1] != (cid, 1)):
            broken += 1
    return {"wrong_slot": wrong_slot, "broken_perennial": broken, "overlap_days": overlap_days(parts, crops),
            "family_run": family_excess(parts, crops)}


def _span(i: int, cid: str, crops: dict[str, Crop]) -> tuple[int, int]:
    """(sow_day, end_day) from W1 start for a crop sown in slot i."""
    c = crops[cid]
    sow = SLOT_START_DAY[i] + c.sow_offset
    return sow, sow + c.total_days


def overlap_days(parts: list[tuple[str, int]], crops: dict[str, Crop]) -> float:
    """Total days by which a crop overlaps the next sown crop beyond the tolerance (cyclic)."""
    sown = [(i, cid) for i, (cid, p) in enumerate(parts) if cid != FALLOW and p == 0]
    if len(sown) < 2:
        return 0.0
    tol = A.get("cal.max_overlap_days")
    total = 0.0
    for k, (i, cid) in enumerate(sown):
        j, nxt = sown[(k + 1) % len(sown)]
        end = _span(i, cid, crops)[1]
        sow_next = _span(j, nxt, crops)[0] + (CYCLE_DAYS if j <= i else 0)
        total += max(0.0, end - sow_next - tol)
    return total


def family_excess(parts: list[tuple[str, int]], crops: dict[str, Crop]) -> float:
    """Seasons beyond the max consecutive run of one botanical family (fallow breaks a run)."""
    lim = int(A.get("opt.max_family_run"))
    run, prev, excess = 0, None, 0
    for cid, _ in parts:
        fam = None if cid == FALLOW else crops[cid].family
        run = run + 1 if (fam is not None and fam == prev) else (1 if fam else 0)
        prev = fam
        excess += max(0, run - lim)
    return float(excess)


# --------------------------------------------------------------------------- engine
@dataclass
class Engine:
    """Calibrated crops + season bank + ECe calibration factor + optional prices."""

    crops: dict[str, Crop]
    bank: BankArrays
    k_cal: float
    prices: pd.DataFrame | None = None
    price_map: dict[str, tuple[float, float]] = field(default_factory=dict)
    _area_memo: dict[tuple, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.prices is not None:
            ok = self.prices.dropna(subset=["price_egp_per_ton", "cost_egp_per_feddan"])
            self.price_map = {str(k): (float(r["price_egp_per_ton"]), float(r["cost_egp_per_feddan"]))
                              for k, r in ok.iterrows()}

    def area_limit(self, cid: str, farm: Farm, ecw: float) -> float:
        """Feddan the well can irrigate at the crop's peak (typical climate), capped at farm area."""
        key = (cid, farm.system, farm.area_fdn, farm.water_m3_day, ecw)
        if key not in self._area_memo:
            self._area_memo[key] = self._area_limit(cid, farm, ecw)
        return self._area_memo[key]

    def _area_limit(self, cid: str, farm: Farm, ecw: float) -> float:
        c = self.crops[cid]
        lr = leaching_requirement(ecw, c.ece100)
        ea = efficiency(farm.system)
        n_parts = 2 if c.perennial else 1
        peak_mm = max(self.bank.typ[(cid, p)]["peak_net"] for p in range(n_parts)) / (ea * (1 - lr))
        peak_m3 = float(mm_to_m3_per_feddan(peak_mm))
        return float(min(farm.area_fdn, farm.water_m3_day / peak_m3)) if peak_m3 > 0 else farm.area_fdn


def simulate(plan: tuple[str, ...], farm: Farm, eng: Engine, years: np.ndarray | None = None,
             d_ecw: float = 0.0, bank: BankArrays | None = None) -> SimResult:
    """Simulate a 6-slot plan.

    ``years``: None → typical climate; else int array (n, 6) of season-years per slot.
    ``bank``: climate bank to read (defaults to ``eng.bank``; pass a warmed/drier bank for deltas).
    Planted area always uses the typical climate (decided before the season).
    """
    bank = bank or eng.bank
    crops = eng.crops
    ecw = farm.ecw + d_ecw
    ea = efficiency(farm.system)
    n = 1 if years is None else years.shape[0]
    start = SoilState(ece=np.full(n, farm.ece0), soc_pct=np.full(n, farm.soc0), n_mg_kg=np.full(n, farm.n0))
    state = start
    traj = [start]
    slots: list[SlotResult] = []
    parts = parts_of(plan, crops)
    areas: dict[str, float] = {}
    for i, (cid, p) in enumerate(parts):
        if cid == FALLOW:
            state, _ = step(state, None, ecw, 0.0, 0.0, 0.0, farm.theta_fc, eng.k_cal)
            traj.append(state)
            z = np.zeros(n)
            slots.append(SlotResult(SLOTS[i], cid, p, 0.0, z, z, 0.0, z * np.nan, z * np.nan, z * np.nan, z, z, z))
            continue
        c = crops[cid]
        key = (cid, p)
        if years is None:
            vals = {k: np.full(n, bank.typ[key][k]) for k in BankArrays.COLS}
        else:
            yr = years[:, i] if p == 0 else years[:, i - 1]  # perennial part 1 uses its sowing year
            vals = {k: bank.gather(key, yr, k) for k in BankArrays.COLS}
        if p == 0 or cid not in areas:
            areas[cid] = eng.area_limit(cid, farm, farm.ecw)
        area = areas[cid]
        f = area / farm.area_fdn
        lr = float(leaching_requirement(ecw, c.ece100))
        need = gross_irrigation(vals["etc"], vals["peff"], lr, ea)
        applied, eta = supply_limited(need, vals, lr, ea, area, farm.water_m3_day)
        drain = drainage_mm(applied, eta, vals["peff"])
        lf = drain / np.maximum(applied + vals["peff"], 1e-9)
        hf = heat_factor(vals["hot_mid"]) * water_factor(eta, vals["etc"])
        _, ece_mean = mix_ece(state.ece, ece_steady(ecw, lf, eng.k_cal), drain, c.root_m, farm.theta_fc)
        sry = salt_rel_yield(c, ece_mean)
        ry = sry * hf
        state, _ = step(state, c, ecw, lf, drain, ry / 100.0, farm.theta_fc, eng.k_cal, f)
        traj.append(state)
        slots.append(SlotResult(SLOTS[i], cid, p, area, applied, mm_to_m3_per_feddan(applied) * area, lr, sry, hf, ry,
                                c.ymax * ry / 100.0, ece_mean, vals["etc"]))
    water = sum(s.water_m3 for s in slots)
    prod = sum((s.area_fdn / farm.area_fdn) * np.nan_to_num(s.rel_yield_pct) / 100.0
               * (crops[s.crop_id].revenue_weight if s.crop_id != FALLOW else 0.0) for s in slots)
    return SimResult(plan=tuple(plan), slots=slots, water_m3=water, productivity=prod,
                     profit_egp=_profit(slots, eng), soil_index=soil_health_index(start, state), start=start,
                     trajectory=traj)


def supply_limited(need_mm, vals: dict[str, np.ndarray], lr: float, ea: float, area: float,
                   q_m3_day: float) -> tuple[np.ndarray, np.ndarray]:
    """Apply the well's m³/day cap during the peak period; return (applied mm, actual ET mm).

    The planted area was sized on the typical peak. In a hotter year, or with saltier water
    (larger LR), the peak gross demand exceeds the well; during the peak period (share
    ``st.peak_share`` of seasonal water) only the ratio r = Q / (area · peak demand) is
    delivered. The shortfall first removes leaching water, then crop water (ETa < ETc).
    """
    peak_need = mm_to_m3_per_feddan(vals["peak_net"] / (ea * (1.0 - lr))) * max(area, 1e-9)
    r = np.minimum(1.0, q_m3_day / np.maximum(peak_need, 1e-9))
    applied = need_mm * (1.0 - A.get("st.peak_share") * (1.0 - r))
    eta = np.minimum(vals["etc"], applied * ea + vals["peff"])
    return applied, eta


def water_factor(eta, etc):
    """FAO-33 yield response to water: 1 − Ky·(1 − ETa/ETc)."""
    ratio = np.where(np.asarray(etc) > 0, np.asarray(eta) / np.maximum(etc, 1e-9), 1.0)
    return np.clip(1.0 - A.get("yield.ky") * (1.0 - ratio), 0.0, 1.0)


def _profit(slots: list[SlotResult], eng: Engine) -> np.ndarray | None:
    """Net profit in EGP when every crop in the plan has a price and cost; else None."""
    crops_in = [s.crop_id for s in slots if s.crop_id != FALLOW]
    if not crops_in or any(c not in eng.price_map for c in crops_in):
        return None
    total = 0.0
    for s in slots:
        if s.crop_id == FALLOW:
            continue
        total = total + slot_profit(s, eng)
    return total


def slot_profit(s: SlotResult, eng: Engine):
    """Net EGP of one season: revenue − production cost − groundwater pumping (econ.pump_egp_m3)."""
    if s.crop_id == FALLOW or s.crop_id not in eng.price_map:
        return 0.0
    price, cost = eng.price_map[s.crop_id]
    if eng.crops[s.crop_id].perennial:
        cost = cost * A.get("econ.perennial_cost_split")
    t_per_fdn = np.nan_to_num(s.yield_kg_ha) * HA_PER_FEDDAN / 1000.0
    revenue = t_per_fdn * price + straw_t_per_fdn(s.crop_id, t_per_fdn) * A.get("econ.straw_price")
    return (revenue - cost) * s.area_fdn - s.water_m3 * A.get("econ.pump_egp_m3")


STRAW_HI = {"barley": "econ.hi_barley", "wheat": "econ.hi_wheat", "triticale": "econ.hi_wheat"}


def straw_t_per_fdn(crop_id: str, grain_t_per_fdn):
    """Cereal straw by-product (t/feddan) = grain × (1 − HI) / HI; zero for other crops."""
    if crop_id not in STRAW_HI:
        return 0.0
    hi = A.get(STRAW_HI[crop_id])
    return grain_t_per_fdn * (1 - hi) / hi


def market_score(plan: tuple[str, ...], farm: Farm, crops: dict[str, Crop]) -> float:
    """Share of cropped slots growing a preferred crop, or a forage crop when the farm has livestock."""
    cropped = [c for c in plan if c != FALLOW]
    if not cropped:
        return 0.0
    ok = [c in farm.preferred or (farm.livestock > 0 and "forage" in crops[c].use) for c in cropped]
    return float(np.mean(ok))


def min_rel_yield(res: SimResult) -> float:
    """Lowest relative yield among cropped slots (typical mode)."""
    vals = [float(np.nanmean(s.rel_yield_pct)) for s in res.slots if s.crop_id != FALLOW]
    return min(vals) if vals else 0.0
