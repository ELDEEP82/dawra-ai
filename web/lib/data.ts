"use client";
/** Client-side loaders for the static JSON (memoised per URL) and helpers to read a configuration file. */
import { useEffect, useState } from "react";
import type { Climate, ConfigFile, Evidence, MapData, Meta, Plan, PlanKind, PickKind, WhatIfGrid } from "./types";

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

export function configPath(ecw: number, water: number): string {
  return `/data/plans/ecw-${ecw}_water-${water}.json`;
}

export function useJson<T>(path: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!path });
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
export const useEvidence = (enabled = true) => useJson<Evidence>(enabled ? "/data/evidence.json" : null);
export const useMapData = (enabled = true) => useJson<MapData>(enabled ? "/data/map.json" : null);
export const useConfig = (ecw: number, water: number, enabled = true) =>
  useJson<ConfigFile>(enabled ? configPath(ecw, water) : null);

/** True shortly after first paint — used to defer non-critical data so the hero renders fast. */
export function useAfterPaint(delay = 1200): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOk(true), delay);
    const onScroll = () => setOk(true);
    window.addEventListener("scroll", onScroll, { once: true, passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [delay]);
  return ok;
}

export function prefetch(ecw: number, water: number): void {
  void load(configPath(ecw, water)).catch(() => undefined);
}

export const PICK_ORDER: PickKind[] = ["current", "max_profit", "min_water", "best_soil"];

/** The five plans shown for a priority profile: current, three picks and the profile's compromise. */
export function plansFor(file: ConfigFile, profile: string): Plan[] {
  const roles: [PlanKind, ConfigFile["picks"][PickKind]][] = [
    ...PICK_ORDER.map((k) => [k, file.picks[k]] as [PlanKind, ConfigFile["picks"][PickKind]]),
    ["compromise", file.compromise[profile] ?? file.compromise.balanced],
  ];
  return roles.map(([kind, view]) => ({
    ...file.plans[view.sig],
    kind,
    view,
    sameAs: roles.filter(([k, v]) => k !== kind && v.sig === view.sig).map(([k]) => k),
  }));
}

/** What-if row for (dT, dRain, dECw, leach) → object keyed by column name. */
export function whatifCell(g: WhatIfGrid, dT: number, dRain: number, dECw: number, leach: number) {
  const { axes } = g;
  const i = axes.dT.indexOf(dT), j = axes.dRain.indexOf(dRain), k = axes.dECw.indexOf(dECw), l = axes.leach.indexOf(leach);
  if (i < 0 || j < 0 || k < 0 || l < 0) return null;
  const idx = ((i * axes.dRain.length + j) * axes.dECw.length + k) * axes.leach.length + l;
  const row = g.rows[idx];
  if (!row) return null;
  const out: Record<string, number | null> = {};
  g.cols.forEach((c, n) => (out[c] = row[n]));
  return out;
}

/** Profile used by Farmer mode answers. */
export const FARMER_PROFILE: Record<string, string> = { money: "profit_first", water: "water_saving", soil: "soil_building" };
