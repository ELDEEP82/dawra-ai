/** Types of the static JSON exported by engine/build.py (web/public/data). */

export type Lang = "en" | "ar";
export type PlanKind = "current" | "max_profit" | "min_water" | "best_soil" | "compromise";

export interface Season {
  slot: string;
  crop_id: string;
  crop_en: string;
  crop_ar: string;
  part: number;
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
}

export interface Totals {
  value: number;
  value_kind: "productivity_index" | "profit_egp";
  value_vs_current_pct: number | null;
  water_m3: number;
  water_vs_current_pct: number;
  water_m3_per_year: number;
  soil_index: number;
  ECe_end: number;
  SOC_end: number;
  N_end: number;
  min_rel_yield: number;
  market_score: number;
  cropped_seasons: number;
  pest_flags: number;
}

export interface ScenarioPass {
  key: string;
  label_en: string;
  label_ar: string;
  pass_pct: number;
}

export interface Robustness {
  robustness_pct: number;
  n_draws: number;
  by_scenario: ScenarioPass[];
  worst: { key: string; pass_pct: number; cause: string; slot: number | null; crop: string | null; share_pct: number };
  cmip6: string;
}

export type CardFields = Record<"why" | "evidence" | "benefits" | "gaps" | "risks", string[]>;

export interface WhatIfCell {
  dT: number;
  dRain: number;
  dECw: number;
  robustness: number;
  rel_yield: (number | null)[];
  yield_kg_ha: number[];
  water_m3: number;
  ece_end: number;
}

export interface Plan {
  id: PlanKind;
  kind: PlanKind;
  label_en: string;
  label_ar: string;
  plan: string[];
  seasons: Season[];
  totals: Totals;
  soil_trajectory: { t: string; ece: number; soc: number; n: number }[];
  robustness: Robustness;
  explanation: { en: CardFields; ar: CardFields };
  whatif: WhatIfCell[];
  same_as: PlanKind[];
}

export interface FrontPoint {
  water_m3: number;
  value: number;
  soil: number;
  risk: number;
  plan: string[];
}

export interface PlanFile {
  farm_id: string;
  ecw: number;
  water_m3_day: number;
  profile: string;
  profile_ar: string;
  weights: Record<string, number>;
  prices_pending: boolean;
  eo_status: string;
  front_size: number;
  evaluated: number;
  front: FrontPoint[];
  plans: Plan[];
}

export interface Meta {
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
  grid: { dT: number[]; dRain: number[]; dECw: number[] };
  scenarios: { key: string; label_en: string; label_ar: string }[];
  crops: { id: string; en: string; ar: string; family: string; use: string; slot: string; perennial: boolean; salt_rating: string; ymax: number | null; ymax_source: string }[];
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

export interface Evidence {
  eo_status: string;
  used_now: { name: string; vars: string; url: string; status: string }[];
  earth_engine: { product: string; dataset: string; ee_id: string; use: string; status: string }[];
  salinity_classes: { class: string; share_1996: number; share_2022: number }[];
  zones: { zone: string; wells: number; mean_ECw_dS_m: number }[];
}

export interface MapData {
  center: [number, number];
  zoom: number;
  markers: { id: string; lat: number; lon: number; en: string; ar: string }[];
  aoi_bbox: [number, number, number, number];
  fields: GeoJSON.FeatureCollection | null;
  fields_status: string;
}
