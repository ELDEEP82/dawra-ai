"use client";
/** Leaflet map with Esri World Imagery, DRC station markers, AOI and (when available) field polygons. */
import "leaflet/dist/leaflet.css";
import { CircleMarker, GeoJSON, MapContainer, Rectangle, TileLayer, Tooltip } from "react-leaflet";
import type { MapData } from "@/lib/types";
import { useLang } from "@/lib/i18n";

const COLORS: Record<string, string> = { drc: "#f9c74f", quinoa: "#90be6d", power: "#4cc9f0" };

export default function MapPanel({ data }: { data: MapData }) {
  const { lang, t } = useLang();
  const [w, s, e, n] = data.aoi_bbox;
  return (
    <div className="relative h-[380px] overflow-hidden rounded-2xl border border-white/10 sm:h-[460px]" dir="ltr">
      <MapContainer center={data.center} zoom={data.zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          maxZoom={18}
        />
        <Rectangle bounds={[[s, w], [n, e]]} pathOptions={{ color: "#4cc9f0", weight: 1, dashArray: "6 6", fillOpacity: 0.03 }}>
          <Tooltip sticky>{lang === "ar" ? "سهل رأس سدر الزراعي (منطقة الدراسة)" : "Ras Sudr agricultural plain (study AOI)"}</Tooltip>
        </Rectangle>
        {data.fields && (
          <GeoJSON data={data.fields} style={{ color: "#90be6d", weight: 1.5, fillOpacity: 0.25 }} />
        )}
        {data.markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lon]}
            radius={m.id === "drc" ? 9 : 7}
            pathOptions={{ color: "#050814", weight: 2, fillColor: COLORS[m.id] ?? "#fff", fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent={m.id === "drc"}>
              {lang === "ar" ? m.ar : m.en}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {data.fields_status !== "ok" && (
        <div className="pointer-events-none absolute bottom-3 start-3 z-[500] rounded-lg bg-space-950/85 px-3 py-1.5 text-xs text-slate-300">
          {t.fieldsPending}
        </div>
      )}
    </div>
  );
}
