"""Command-line entry points: ``python -m dawra.pipeline data``.

``data`` refreshes NASA inputs (POWER 1981→, Earth Engine when authenticated)
and rewrites the data reports. ``build.py`` (engine root) runs the models and
exports the static JSON for the web app.
"""
from __future__ import annotations

import sys


def data(refresh: bool = True) -> None:
    """Fetch/extend NASA POWER, try Earth Engine, write reports 01/02/04."""
    from . import climate, climate_report, eo, eo_report

    climate.extend_power(refresh=refresh)
    climate_report.write_report()
    status = eo.extract_all()
    eo_report.write_report(status)
    print("EO status:", status.get("status"), "-", status.get("message", ""))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "data"
    if cmd == "data":
        data()
    else:
        raise SystemExit(f"unknown command {cmd}")
