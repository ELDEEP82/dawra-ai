"""Read model assumptions from ``data/assumptions.csv``.

Every tunable number in the engine is looked up here by id, so each value is
traceable to a justification and a source, and the sensitivity analysis can
perturb any of them with :func:`override`.
"""
from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

import pandas as pd

from .config import ASSUMPTIONS_CSV

_OVERRIDES: dict[str, float] = {}


@lru_cache(maxsize=1)
def table() -> pd.DataFrame:
    """Return the assumptions table indexed by ``id``."""
    df = pd.read_csv(ASSUMPTIONS_CSV, dtype={"id": str})
    if df["id"].duplicated().any():
        dups = df.loc[df["id"].duplicated(), "id"].tolist()
        raise ValueError(f"duplicate assumption ids: {dups}")
    return df.set_index("id")


@lru_cache(maxsize=1)
def _numeric() -> dict[str, float]:
    """All numeric assumption values as a plain dict (fast lookups in inner loops)."""
    vals = pd.to_numeric(table()["value"], errors="coerce")
    return {k: float(v) for k, v in vals.items() if pd.notna(v)}


def get(aid: str) -> float:
    """Return the numeric value of assumption ``aid`` (honouring overrides)."""
    if _OVERRIDES and aid in _OVERRIDES:
        return _OVERRIDES[aid]
    try:
        return _numeric()[aid]
    except KeyError:
        raise KeyError(f"assumption '{aid}' missing or not numeric in {ASSUMPTIONS_CSV.name}") from None


def get_str(aid: str) -> str:
    """Return the raw (string) value of assumption ``aid``."""
    return str(table().at[aid, "value"])


def has(aid: str) -> bool:
    """True if assumption ``aid`` exists."""
    return aid in table().index


def numeric_ids() -> list[str]:
    """Ids of all assumptions with a numeric value (used by the sensitivity run)."""
    tab = table()
    vals = pd.to_numeric(tab["value"], errors="coerce")
    return [i for i, v in vals.items() if pd.notna(v) and v != 0]


@contextmanager
def override(values: dict[str, float]) -> Iterator[None]:
    """Temporarily override assumption values (sensitivity analysis)."""
    old = dict(_OVERRIDES)
    _OVERRIDES.update(values)
    try:
        yield
    finally:
        _OVERRIDES.clear()
        _OVERRIDES.update(old)
