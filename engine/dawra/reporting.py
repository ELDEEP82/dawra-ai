"""Small helpers shared by the markdown report writers."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from .config import FIGURES  # noqa: E402

DARK = {"bg": "#0b1020", "fg": "#e6e9f2", "grid": "#26304a", "a": "#4cc9f0", "b": "#f9c74f", "c": "#f94144",
        "d": "#90be6d", "e": "#b388ff"}


def md_table(df: pd.DataFrame, floatfmt: str = "{:.1f}") -> str:
    """Render a DataFrame as a GitHub markdown table without extra dependencies."""
    cols = [str(c) for c in df.columns]
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for r in df.astype(object).itertuples(index=False):
        cells = []
        for v in r:
            if isinstance(v, float):
                cells.append(floatfmt.format(v))
            else:
                cells.append(str(v))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def new_fig(w: float = 8, h: float = 4):
    """Figure + axis with a light, print-friendly style."""
    fig, ax = plt.subplots(figsize=(w, h), dpi=120)
    ax.grid(alpha=0.3)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    return fig, ax


def save_fig(fig, name: str) -> Path:
    """Save under reports/figures and return the relative path used in markdown."""
    FIGURES.mkdir(parents=True, exist_ok=True)
    path = FIGURES / name
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
    return Path("figures") / name
