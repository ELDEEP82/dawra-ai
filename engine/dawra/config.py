"""Project paths and physical constants that are definitions (not model assumptions).

Model assumptions live in ``data/assumptions.csv`` and are read through
:mod:`dawra.assumptions`; only unit definitions and file locations are here.
"""
from __future__ import annotations

from pathlib import Path

ROOT: Path = Path(__file__).resolve().parents[2]
DATA: Path = ROOT / "data"
RAW: Path = DATA / "raw"
PROCESSED: Path = DATA / "processed"
EO_DIR: Path = DATA / "eo"
REPORTS: Path = ROOT / "reports"
FIGURES: Path = REPORTS / "figures"
WEB_DATA: Path = ROOT / "web" / "public" / "data"

POWER_CSV: Path = RAW / "TerraNex_NASA_POWER.csv"
LOCAL_XLSX: Path = RAW / "ras_sudr_local_data_1.xlsx"
ASSUMPTIONS_CSV: Path = DATA / "assumptions.csv"
PRICES_CSV: Path = DATA / "prices_egp.csv"
POWER_EXTENDED: Path = PROCESSED / "power_1981_2026.parquet"

# Unit definitions (CLAUDE.md): 1 feddan = 0.42 ha; 1 mm over 1 feddan = 4.2 m3.
HA_PER_FEDDAN: float = 0.42
M3_PER_MM_FEDDAN: float = 4.2

# DRC Ras Sudr research station (Site sheet, S1).
STATION_LAT: float = 29.599722
STATION_LON: float = 32.701389
# NASA POWER pixel of our CSV header.
POWER_LAT: float = 29.5907
POWER_LON: float = 32.7203
POWER_ELEV_M: float = 215.24

WINTER_MONTHS: tuple[int, ...] = (11, 12, 1, 2, 3, 4)
SUMMER_MONTHS: tuple[int, ...] = (5, 6, 7, 8, 9, 10)
SLOTS: tuple[str, ...] = ("W1", "S1", "W2", "S2", "W3", "S3")
