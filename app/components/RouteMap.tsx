"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPinned } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";

type Props = {
  gpxUrl: string;
  name: string;
  laps?: number;
};

type Coordinate = [number, number];

function parseGpx(text: string): Coordinate[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Neplatný GPX soubor.");

  return Array.from(doc.querySelectorAll("trkpt"))
    .map(point => [
      Number(point.getAttribute("lon")),
      Number(point.getAttribute("lat")),
    ] as Coordinate)
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

export default function RouteMap({ gpxUrl, name, laps = 1 }: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!elementRef.current) return;

    let alive = true;
    let map: MapLibreMap | null = null;
    const controller = new AbortController();

    const load = async () => {
      try {
        const ml = await import("maplibre-gl");
        if (!alive || !elementRef.current) return;

        const response = await fetch(
          "/api/routes/gpx?url=" + encodeURIComponent(gpxUrl),
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error("GPX se nepodařilo načíst.");

        const text = await response.text();
        const basePoints = parseGpx(text);
        if (basePoints.length < 2) throw new Error("GPX neobsahuje dostatek bodů.");

        const routePoints =
          Math.max(1, Math.floor(laps)) === 1
            ? basePoints
            : Array.from({ length: Math.max(1, Math.floor(laps)) }, () => basePoints).flat();

        const minX = Math.min(...routePoints.map(point => point[0]));
        const maxX = Math.max(...routePoints.map(point => point[0]));
        const minY = Math.min(...routePoints.map(point => point[1]));
        const maxY = Math.max(...routePoints.map(point => point[1]));

        map = new ml.Map({
          container: elementRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              {
                id: "osm",
                type: "raster",
                source: "osm",
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: [(minX + maxX) / 2, (minY + maxY) / 2],
          zoom: 13,
          maxZoom: 19,
          attributionControl: { compact: true },
        });

        mapRef.current = map;

        map.once("load", () => {
          if (!alive || !map) return;

          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: routePoints },
            },
          });

          map.addLayer({
            id: "route-glow",
            type: "line",
            source: "route",
            paint: {
              "line-color": "#64d9ff",
              "line-width": 9,
              "line-opacity": 0.18,
              "line-blur": 3,
            },
          });

          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            paint: {
              "line-color": "#69e6a3",
              "line-width": 4,
              "line-opacity": 0.98,
            },
          });

          map.addSource("route-start", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: routePoints[0] },
            },
          });

          map.addSource("route-end", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: routePoints[routePoints.length - 1] },
            },
          });

          map.addLayer({
            id: "route-start",
            type: "circle",
            source: "route-start",
            paint: {
              "circle-radius": 7,
              "circle-color": "#69e6a3",
              "circle-stroke-color": "#10231d",
              "circle-stroke-width": 3,
            },
          });

          map.addLayer({
            id: "route-end",
            type: "circle",
            source: "route-end",
            paint: {
              "circle-radius": 7,
              "circle-color": "#ff6b78",
              "circle-stroke-color": "#30171b",
              "circle-stroke-width": 3,
            },
          });

          const bounds = new ml.LngLatBounds(routePoints[0], routePoints[0]);
          routePoints.forEach(point => bounds.extend(point));
          map.fitBounds(bounds, {
            padding: { top: 34, bottom: 34, left: 34, right: 34 },
            duration: 0,
            maxZoom: 16,
          });

          setState("ready");
        });

        window.setTimeout(() => {
          if (alive && map && !map.isStyleLoaded()) setState("error");
        }, 15000);
      } catch (error) {
        if (alive && (error as Error).name !== "AbortError") setState("error");
      }
    };

    load();

    return () => {
      alive = false;
      controller.abort();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [gpxUrl, laps]);

  return (
    <div className="route-map-shell">
      <div ref={elementRef} className="route-map" aria-label={"Mapa trasy " + name} />
      {state === "loading" && (
        <div className="route-map-state">
          <LoaderCircle className="route-map-spin" size={20} />
          <span>Načítám trasu…</span>
        </div>
      )}
      {state === "error" && (
        <div className="route-map-state">
          <MapPinned size={20} />
          <span>Interaktivní mapa se nepodařila načíst. Trasu můžeš stále otevřít v Mapy.com.</span>
        </div>
      )}
      {state === "ready" && (
        <div className="route-map-badge">
          <MapPinned size={14} /> GPX trasa
        </div>
      )}
    </div>
  );
}
