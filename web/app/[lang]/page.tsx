/** Home (server component): hero numbers are computed here from the static JSON at build time, so the final values
 *  are in the first HTML byte; the interactive app hydrates on top. */
import fs from "node:fs";
import path from "node:path";
import HomeApp from "@/components/HomeApp";
import type { HeroData } from "@/components/Hero";
import type { Climate, Evidence, Meta } from "@/lib/types";

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", rel), "utf8")) as T;
}

function heroData(): HeroData {
  const climate = readJson<Climate>("climate.json");
  const meta = readJson<Meta>("meta.json");
  const evidence = readJson<Evidence>("evidence.json");
  const v = evidence.eo.veg_check.find((r) => r.threshold === 0.25);
  if (!v) throw new Error("evidence.json: veg_check threshold 0.25 missing");
  return {
    rainPct: (climate.summary.rain_mm / climate.summary.et0_mm) * 100,
    rainMm: climate.summary.rain_mm,
    et0Mm: climate.summary.et0_mm,
    ecw: meta.farm.well_ECw_dS_m,
    green2022: v.s16_2022,
    green1996: v.s16_1996,
  };
}

export default function Page() {
  return <HomeApp hero={heroData()} />;
}
