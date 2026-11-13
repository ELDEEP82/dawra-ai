"""M5 — evidence engine from NDVI time series (Prompt 4).

Works on any NDVI DataFrame (``date``, ``ndvi`` and optionally ``field_id``), so it is
fully testable on synthetic series while the Earth Engine extraction is pending.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import savgol_filter
from sklearn.cluster import KMeans

from .data_io import season_labels

AMP_CROP = 0.15  # NDVI amplitude that marks an active crop (same threshold as field_candidates)
NDVI_BARE = 0.15


def smooth_16d(df: pd.DataFrame, col: str = "ndvi") -> pd.Series:
    """16-day max composite, gap-filled by interpolation, Savitzky–Golay smoothed (window 5, order 2)."""
    s = df.set_index("date")[col].resample("16D").max().interpolate(limit=4).dropna()
    if len(s) >= 5:
        s = pd.Series(savgol_filter(s.to_numpy(), 5, 2), index=s.index)
    return s.clip(-0.2, 1.0)


def phenology(series: pd.Series) -> pd.DataFrame:
    """Per season (W/S, season_year): start, peak date, end, peak, amplitude, integral."""
    lab = season_labels(series.index)
    rows = []
    for (y, s), sub in series.groupby([lab["season_year"].to_numpy(), lab["season"].to_numpy()]):
        if len(sub) < 4:
            continue
        base = float(sub.min())
        amp = float(sub.max() - base)
        thr = base + 0.5 * amp
        above = sub[sub >= thr]
        rows.append({"season_year": int(y), "season": s, "start": above.index.min(), "peak_date": sub.idxmax(),
                     "end": above.index.max(), "peak": float(sub.max()), "base": base, "amplitude": amp,
                     "integral": float((sub - base).clip(lower=0).sum() * 16)})
    return pd.DataFrame(rows)


def classify_season(features: pd.DataFrame) -> pd.Series:
    """Transparent rules: bare / winter_crop / summer_crop / perennial (persistently green)."""
    out = []
    for _, r in features.iterrows():
        if r["base"] >= 0.3:
            out.append("perennial")
        elif r["amplitude"] < AMP_CROP or r["peak"] < NDVI_BARE + 0.1:
            out.append("bare")
        else:
            out.append("winter_crop" if r["season"] == "W" else "summer_crop")
    return pd.Series(out, index=features.index, name="label")


def kmeans_agreement(features: pd.DataFrame, labels: pd.Series, seed: int = 0) -> float:
    """Share of seasons where a 4-cluster KMeans (majority-mapped) agrees with the rule labels."""
    x = features[["peak", "base", "amplitude", "integral"]].to_numpy()
    k = min(4, len(np.unique(labels)), len(x))
    if k < 2:
        return 1.0
    cl = KMeans(n_clusters=k, n_init=10, random_state=seed).fit_predict((x - x.mean(0)) / (x.std(0) + 1e-9))
    mapped = pd.Series(cl).map(pd.DataFrame({"c": cl, "l": labels.to_numpy()}).groupby("c")["l"].agg(
        lambda s: s.mode().iloc[0]))
    return float((mapped.to_numpy() == labels.to_numpy()).mean())


def bare_calendar(features: pd.DataFrame, labels: pd.Series) -> pd.DataFrame:
    """Share of years each season type is bare."""
    d = features.assign(label=labels.to_numpy())
    return d.groupby("season")["label"].apply(lambda s: float((s == "bare").mean())).rename("bare_share").reset_index()


def vulnerable_seasons(features: pd.DataFrame, stress: pd.DataFrame) -> pd.DataFrame:
    """Seasons whose NDVI peak is in the bottom quartile AND a stress indicator is in its worst quartile.

    ``stress`` is indexed like features (season_year, season) with columns such as heat_days (higher worse),
    lst_anom (higher worse), sm_anom (lower worse).
    """
    f = features.set_index(["season_year", "season"])
    j = f.join(stress, how="inner")
    if j.empty:
        return j
    low_peak = j["peak"] <= j["peak"].quantile(0.25)
    bad = pd.Series(False, index=j.index)
    for col, worse_high in (("heat_days", True), ("lst_anom", True), ("sm_anom", False)):
        if col in j:
            q = j[col].quantile(0.75 if worse_high else 0.25)
            bad |= (j[col] >= q) if worse_high else (j[col] <= q)
    return j[low_peak & bad].reset_index()


def current_rotation_guess(features: pd.DataFrame, labels: pd.Series, years: int = 3) -> list[str]:
    """Most common winter/summer labels over the last ``years`` years (pre-fills the app; farmer confirms)."""
    d = features.assign(label=labels.to_numpy())
    last = d[d["season_year"] > d["season_year"].max() - years]
    out = []
    for s in ("W", "S"):
        sub = last[last["season"] == s]["label"]
        out.append(sub.mode().iloc[0] if not sub.empty else "unknown")
    return out


def transition_evidence(all_fields: pd.DataFrame) -> pd.DataFrame:
    """Mean next-season NDVI peak after each previous label, with counts (exploratory).

    ``all_fields`` columns: field_id, season_year, season, peak, label — in time order per field.
    """
    d = all_fields.assign(_t=all_fields["season_year"] * 2 + (all_fields["season"] == "S")).sort_values(
        ["field_id", "_t"])
    d["prev_label"] = d.groupby("field_id")["label"].shift(1)
    g = d.dropna(subset=["prev_label"]).groupby(["prev_label", "season"])["peak"]
    out = g.agg(["mean", "count"]).reset_index().rename(columns={"mean": "next_peak_mean", "count": "n"})
    out["caveat"] = "exploratory — correlation only, not a causal effect"
    return out


def vegetated_area_check(model_ha: float, reference_ha: float = 1579.08, tol: float = 0.25) -> dict:
    """Compare EO vegetated area with S16 (1,579 ha in 2022)."""
    err = model_ha / reference_ha - 1
    return {"model_ha": model_ha, "reference_ha": reference_ha, "error_pct": err * 100, "pass": abs(err) <= tol}
