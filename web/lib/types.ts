/** Types of the static JSON exported by engine/build.py (web/public/data), schema version 2. */

export type Lang = "en" | "ar";
export type PickKind = "current" | "max_profit" | "min_water" | "best_soil";
export type PlanKind = PickKind | "compromise";

export interface Season {
  slot: string;
  crop_id: string;
  crop_en: string;
  crop_ar: string;
  part: number;
  idle_fdn: number;
  family?: string;
  use?: string;
  sow?: string | null;
  harvest?: string | null;
  area_fdn: number;
  water_mm: number;
  water_m3: number;
  etc_mm?: number;
  lr_pct?: number;
  salt_ry_pct?: number | null;
  heat_factor?: number | null;
  rel_yield_pct: number | null;
  yield_kg_ha: number;
  yield_t_per_fdn?: number;
  farm_output_t?: number;
  ece_mean?: number;
  salt_rating?: string;
  n_fixing?: boolean;
  revenue_egp?: number | null;
  cost_egp?: number | null;
  pumping_egp?: number | null;
  profit_egp?: number | null;
}

export interface Totals {
  value: number;
  value_kind: "productivity_index" | "profit_egp";
  value_vs_current_pct: number | null;
  water_m3: number;
  water_vs_current_pct: number;
  water_m3_per_year: number;
  soil_index: number;
  profit_per_feddan_year: number | null;
  ECe_end: number;
  SOC_end: number;
  N_end: number;
  min_rel_yield: number;
  market_score: number;
  cropped_seasons: number;
  pest_flags: number;
  product_t: number;
  kg_per_m3: number;
  m3_per_1000_egp: number | null;
  egp_per_m3: number | null;
  idle_fdn_avg: number;
}

export interface Band {
  p10: number;
  p50: number;
  p90: number;
}

export interface Robustness {
  robustness_pct: number;
  n_draws: number;
  by_scenario: { key: string; label_en: string; label_ar: string; pass_pct: number }[];
  by_leaching: { leach_pct: number; pass_pct: number; salt_buildup_pct: number }[];
  worst: { key: string; leach_pct: number; pass_pct: number; cause: string; slot: number | null; crop: string | null; share_pct: number };
  bands: { product_t: Band; profit_egp: Band | null; ece_end: Band } | null;
  paths: Record<string, { ece: number[][]; pass: boolean[] }> | null;
  cmip6: string;
}

export type CardFields = Record<"why" | "evidence" | "benefits" | "gaps" | "risks", string[]>;

export interface WhatIfGrid {
  axes: { dT: number[]; dRain: number[]; dECw: number[]; leach: number[] };
  cols: string[];
  rows: (number | null)[][];
}

export interface PlanData {
  plan: string[];
  area_frac: number[] | null;
  seasons: Season[];
  totals: Totals;
  soil_trajectory: { t: string; ece: number; soc: number; n: number }[];
  robustness: Robustness;
  whatif: WhatIfGrid;
}

export interface View {
  sig: string;
  label_en: string;
  label_ar: string;
  rank_flips: string[];
  explanation: { en: CardFields; ar: CardFields };
}

/** A plan as shown in the UI: library data + the view (label, card) for one role. */
export interface Plan extends PlanData {
  kind: PlanKind;
  view: View;
  sameAs: PlanKind[];
}

export interface ConfigFile {
  version: 2;
  farm_id: string;
  ecw: number;
  water_m3_day: number;
  prices_pending: boolean;
  eo_status: string;
  front_size: number;
  evaluated: number;
  front: [number, number, number, number][]; // water, value, soil, risk
  explored: [number, number][]; // water, value in search order
  plans: Record<string, PlanData>;
  picks: Record<PickKind, View>;
  compromise: Record<string, View>;
  weights: Record<string, Record<string, number>>;
}

export interface Meta {
  version: number;
  built_utc: string;
  farm: {
    farmer_id: string;
    area_feddan: number;
    well_ECw_dS_m: number;
    water_m3_per_day: number;
    irrigation_system: string;
    livestock_heads: number;
    last_crop: string;
    preferred_crops: string[];
    avoid_crops: string[];
    budget_level: string;
    labour_level: string;
    market_channel: string;
  };
  ecw_options: number[];
  water_options: number[];
  profiles: { id: string; label_ar: string; weights: Record<string, number> }[];
  prices_pending: boolean;
  eo_status: string;
  grid: { dT: number[]; dRain: number[]; dECw: number[]; leach: number[] };
  whatif_cols: string[];
  pump_egp_m3: number;
  scenarios: { key: string; label_en: string; label_ar: string }[];
  crops: { id: string; en: string; ar: string; family: string; use: string; slot: string; perennial: boolean; salt_rating: string; ymax: number | null; ymax_source: string; price_egp_t: number | null; cost_egp_fdn: number | null; price_estimated: boolean | null }[];
  sources: { id: string; reference: string; url: string }[];
  n_assumptions: number;
  k_cal: number;
}

export interface Climate {
  source: string;
  summary: { et0_mm: number; rain_mm: number; heat_days: number; gwet_summer: number; years: string };
  annual: { year: number; et0: number; rain: number; tmax: number; tmin: number; heat_days: number; gwet: number }[];
  monthly: { month: number; tmin: number; tmax: number; rain: number; et0: number; gwet: number; s1_tmin: number | null; s1_tmax: number | null; s1_rain: number | null }[];
  hottest: { season_year: number; season: string; tmax_mean: number; tmax_anom: number; heat_days: number }[];
  driest: { season_year: number; season: string; rain_mm: number; ET0_mm: number }[];
}

export type Series = [string, number][];

export interface EOData {
  summary: Record<string, number | Record<string, number> | null>;
  veg_check: { threshold: number; model_1996: number | null; s16_1996: number; model_2022: number | null; s16_2022: number }[];
  modis_et_check: { status?: string; reason?: string; r?: number } | null;
  veg_area?: { year: number; landsat_scenes: number; [k: string]: number }[];
  ndvi_station?: Series;
  smap_rootzone?: Series;
  smap_surface?: Series;
  modis_lst?: Series;
  grace?: Series;
  imerg_annual?: { year: number; days_gt10: number; days_gt20: number; annual_mm: number }[];
  cmip6?: { models: string[]; ensemble: Record<string, { d_t: number[]; rain_scale: number[] }> };
  fields?: { n_fields: number; area_ha: number; labels: Record<string, number>; rotation_guess_counts: Record<string, number>; kmeans_agreement: number };
}

export interface Evidence {
  eo_status: string;
  used_now: { name: string; vars: string; url: string; status: string }[];
  earth_engine: { product: string; dataset: string; ee_id: string; use: string; status: string }[];
  eo: EOData;
  salinity_classes: { class: string; share_1996: number; share_2022: number }[];
  zones: { zone: string; wells: number; mean_ECw_dS_m: number }[];
}

export interface FieldProps {
  field_id: string;
  area_ha: number;
  lon: number;
  lat: number;
  guess_W?: string;
  guess_S?: string;
  bare_W?: number;
  bare_S?: number;
  ndvi_peak_mean?: number;
  slope_deg?: number;
  elev_m?: number;
}

export interface MapData {
  center: [number, number];
  zoom: number;
  markers: { id: string; lat: number; lon: number; en: string; ar: string }[];
  aoi_bbox: [number, number, number, number];
  rain_bbox: [number, number, number, number];
  fields: GeoJSON.FeatureCollection<GeoJSON.Geometry, FieldProps> | null;
  fields_status: string;
  overlays: { aoi_bbox: number[]; rain_bbox: number[]; ndvi: Record<string, string>; lst: string; slope: string; rain: string } | null;
}
