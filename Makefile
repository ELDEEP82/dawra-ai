# Dawra AI — common targets. On Windows without make, use: python tasks.py <target>
ifeq ($(OS),Windows_NT)
PY := .venv/Scripts/python.exe
else
PY := .venv/bin/python
endif
ENGINE_PY := ../$(PY)

.PHONY: venv test data build web all

venv:
	uv venv --python 3.11 .venv && uv pip install --python $(PY) -r engine/requirements.txt

test:
	cd engine && $(ENGINE_PY) -m pytest -q

# Fetch/extend NASA data (POWER 1981+, Earth Engine if authenticated) and write reports.
data:
	cd engine && $(ENGINE_PY) -m dawra.pipeline data

# Run the whole engine and export static JSON to web/public/data/.
build:
	cd engine && $(ENGINE_PY) build.py

web:
	cd web && npm install && npm run build

all: test data build web
