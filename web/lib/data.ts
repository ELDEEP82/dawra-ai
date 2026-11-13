"use client";
/** Client-side loaders for the static JSON (memoised per URL, so each file is fetched once). */
import { useEffect, useState } from "react";
import type { Climate, Evidence, MapData, Meta, PlanFile } from "./types";

const cache = new Map<string, Promise<unknown>>();

export function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

/** Stem used by engine/build.py, e.g. ecw-8.35_water-60_balanced */
export function planPath(ecw: number, water: number, profile: string): string {
  return `/data/plans/ecw-${fmtNum(ecw)}_water-${fmtNum(water)}_${profile}.json`;
}

function fmtNum(x: number): string {
  return Number.isInteger(x) ? String(x) : String(x);
}

export function useJson<T>(path: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: !!path,
  });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load<T>(path)
      .then((d) => alive && setState({ data: d, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

export const useMeta = () => useJson<Meta>("/data/meta.json");
export const useClimate = () => useJson<Climate>("/data/climate.json");
export const useEvidence = () => useJson<Evidence>("/data/evidence.json");
export const useMapData = () => useJson<MapData>("/data/map.json");
export const usePlans = (ecw: number, water: number, profile: string) =>
  useJson<PlanFile>(planPath(ecw, water, profile));

/** Warm the cache for neighbouring selections so switching feels instant. */
export function prefetch(ecw: number, water: number, profile: string): void {
  void load(planPath(ecw, water, profile)).catch(() => undefined);
}
