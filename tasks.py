"""Cross-platform task runner (mirrors the Makefile for machines without `make`).

Usage:  python tasks.py test | data | build | web | all
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PY = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
PY = str(VENV_PY if VENV_PY.exists() else Path(sys.executable))
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(cmd: list[str], cwd: Path = ROOT) -> None:
    """Run a command and stop on failure."""
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


TASKS = {
    "test": lambda: run([PY, "-m", "pytest", "-q"], ROOT / "engine"),
    "data": lambda: run([PY, "-m", "dawra.pipeline", "data"], ROOT / "engine"),
    "build": lambda: run([PY, "build.py"], ROOT / "engine"),
    "web": lambda: (run([NPM, "install"], ROOT / "web"), run([NPM, "run", "build"], ROOT / "web")),
}

if __name__ == "__main__":
    names = sys.argv[1:] or ["test"]
    if names == ["all"]:
        names = ["test", "data", "build", "web"]
    for n in names:
        TASKS[n]()
