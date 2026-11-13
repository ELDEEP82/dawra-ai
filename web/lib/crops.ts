/** Visual identity for crops (colour + icon). */
export const CROP_STYLE: Record<string, { color: string; icon: string }> = {
  barley: { color: "#e9c46a", icon: "🌾" },
  wheat: { color: "#f4a261", icon: "🌾" },
  triticale: { color: "#d4a373", icon: "🌾" },
  barley_forage: { color: "#a7c957", icon: "🌿" },
  sorghum: { color: "#e76f51", icon: "🌾" },
  pearl_millet: { color: "#bc6c25", icon: "🌾" },
  sudan_grass: { color: "#6a994e", icon: "🌿" },
  bermuda: { color: "#2a9d8f", icon: "🌱" },
  rhodes: { color: "#52b788", icon: "🌱" },
  sugar_beet: { color: "#c9184a", icon: "🥕" },
  quinoa: { color: "#ffb703", icon: "🌾" },
  cotton: { color: "#e0e1dd", icon: "☁️" },
  alfalfa: { color: "#40916c", icon: "☘️" },
  cowpea: { color: "#9b5de5", icon: "🌱" },
  faba_bean: { color: "#7b2cbf", icon: "🌱" },
  sesbania: { color: "#00bbf9", icon: "🌱" },
  tomato: { color: "#ef233c", icon: "🍅" },
  squash: { color: "#80b918", icon: "🥒" },
  watermelon: { color: "#ff4d6d", icon: "🍉" },
  date_palm: { color: "#9c6644", icon: "🌴" },
  olive: { color: "#606c38", icon: "🌳" },
  fallow: { color: "#C9CBC3", icon: "·" },
};

/** Categorical plan colours — dataviz reference palette, light steps, validated on #FFFFFF (all checks pass;
 *  three slots < 3:1 contrast, so plans are always shown with their name next to the colour). */
export const PLAN_COLORS: Record<string, string> = {
  current: "#2a78d6",
  max_profit: "#eb6834",
  min_water: "#1baf7a",
  best_soil: "#eda100",
  compromise: "#e87ba4",
};

/** Two-series charts on one axis: rain (sky) vs ET0 (sand); temperature max/min; soil moisture (leaf). */
export const SERIES = { rain: "#2D8CFF", et0: "#E08A1E", tmax: "#E5533D", tmin: "#2D8CFF", soil: "#2BB673" };

export function cropStyle(id: string) {
  return CROP_STYLE[id] ?? { color: "#888", icon: "🌱" };
}
