"use client";
/** Leaflet map: Esri World Imagery + NASA layers (NDVI by year, MODIS LST, IMERG rain, SRTM slope) + Sentinel-2 fields. */
import "leaflet/dist/leaflet.css";
import { CircleMarker, GeoJSON, ImageOverlay, MapContainer, Rectangle, TileLayer, Tooltip } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, Geometry } from "geojson";
import type { FieldProps, MapData } from "@/lib/types";
import { useLang } from "@/lib/i18n";

export type MapLayer = "ndvi" | "lst" | "rain" | "slope" | "none";

const MARKER: Record<string, string> = { drc: "#E8A23A", quinoa: "#2BB673", power: "#2D8CFF" };
export const PATTERN_COLOR: Record<string, string> = {
  "perennial/perennial": "#2a9d8f",
  "winter_crop/bare": "#e9c46a",
  "winter_crop/summer_crop": "#f4a261",
  "bare/bare": "#9ca3af",
  "perennial/bare": "#90be6d",
  "bare/perennial": "#52b788",
  "perennial/summer_crop": "#b388ff",
  "bare/summer_crop": "#d55181",
};
const PATTERN_AR: Record<string, string> = {
  perennial: "معمّر", winter_crop: "شتوي", summer_crop: "صيفي", bare: "بور", unknown: "؟",
};

export function patternOf(p: FieldProps): string {
  return `${p.guess_W ?? "unknown"}/${p.guess_S ?? "unknown"}`;
}

export function patternLabel(pattern: string, lang: string): string {
  if (lang !== "ar") return pattern.replace(/_/g, " ");
  return pattern.split("/").map((x) => PATTERN_AR[x] ?? x).join(" / ");
}

export type Basemap = "light" | "satellite";

export default function MapPanel({ data, layer, year, basemap = "light", height = "h-[420px] sm:h-[520px]" }: { data: MapData; layer: MapLayer; year: number; basemap?: Basemap; height?: string }) {
  const { lang } = useLang();
  const [w, s, e, n] = data.aoi_bbox;
  const ov = data.overlays;
  const aoiBounds: [[number, number], [number, number]] = [[s, w], [n, e]];
  const rb = data.rain_bbox;
  const ndviFile = ov?.ndvi[String(year)];
  const style = (f?: Feature<Geometry, FieldProps>): PathOptions => {
    const c = f ? PATTERN_COLOR[patternOf(f.properties)] ?? "#f9c74f" : "#f9c74f";
    return { color: c, weight: 1.5, fillColor: c, fillOpacity: 0.35 };
  };
  const onEach = (f: Feature<Geometry, FieldProps>, l: Layer) => {
    const p = f.properties;
    const pat = patternLabel(patternOf(p), lang);
    const html =
      lang === "ar"
        ? `<b>${p.field_id}</b><br/>${p.area_ha} هكتار · ميل ${p.slope_deg ?? "—"}°<br/>نمط آخر 3 سنين: ${pat}<br/>أعلى NDVI متوسط: ${p.ndvi_peak_mean ?? "—"}`
        : `<b>${p.field_id}</b><br/>${p.area_ha} ha · slope ${p.slope_deg ?? "—"}°<br/>Last-3-yr pattern: ${pat}<br/>Mean NDVI peak: ${p.ndvi_peak_mean ?? "—"}`;
    l.bindTooltip(html, { sticky: true });
  };
  return (
    <div className={`relative isolate overflow-hidden rounded-card border border-line shadow-card ${height}`} dir="ltr">
      <MapContainer center={data.center} zoom={data.zoom} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        {basemap === "satellite" ? (
          <TileLayer
            key="sat"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community · NASA/USGS Landsat, ESA Sentinel-2, NASA MODIS/GPM/SRTM via Google Earth Engine"
            maxZoom={18}
          />
        ) : (
          <TileLayer
            key="light"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors · NASA/USGS Landsat, ESA Sentinel-2, NASA MODIS/GPM/SRTM via Google Earth Engine"
            maxZoom={16}
          />
        )}
        {ov && layer === "ndvi" && ndviFile && <ImageOverlay key={ndviFile} url={`/data/overlays/${ndviFile}`} bounds={aoiBounds} opacity={0.85} />}
        {ov && layer === "lst" && <ImageOverlay url={`/data/overlays/${ov.lst}`} bounds={aoiBounds} opacity={0.6} />}
        {ov && layer === "slope" && <ImageOverlay url={`/data/overlays/${ov.slope}`} bounds={aoiBounds} opacity={0.7} />}
        {ov && layer === "rain" && <ImageOverlay url={`/data/overlays/${ov.rain}`} bounds={[[rb[1], rb[0]], [rb[3], rb[2]]]} opacity={0.55} />}
        <Rectangle bounds={aoiBounds} pathOptions={{ color: "#0F6B4F", weight: 1, dashArray: "6 6", fillOpacity: 0 }} />
        {data.fields && <GeoJSON key={lang} data={data.fields} style={style as (f?: Feature) => PathOptions} onEachFeature={onEach as (f: Feature, l: Layer) => void} />}
        {data.markers.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={m.id === "drc" ? 9 : 6} pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: MARKER[m.id] ?? "#fff", fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]} permanent={m.id === "drc"}>
              {lang === "ar" ? m.ar : m.en}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
