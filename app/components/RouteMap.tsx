"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPinned } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";

type Props = {
  gpxUrl: string;
  mapUrl?: string;
  name: string;
  laps?: number;
  interactive?: boolean;
  mapStyle?: "standard" | "minimal";
  showInfo?: boolean;
};

type Coordinate = [number, number];

type ParsedGpx = {
  coordinates: Coordinate[];
  elevations: (number | null)[];
};

type RouteStats = {
  distanceKm: number;
  elevationGain: number | null;
  minElevation: number | null;
  maxElevation: number | null;
};

const CLIENT_TIMEOUT_MS = 12_000;
const ROUTE_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
};

function parseGpx(text: string): ParsedGpx {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Neplatný GPX soubor.");

  const getPoints = (tag: "trkpt" | "rtept") => {
    const namespaced = Array.from(doc.getElementsByTagNameNS("*", tag));
    return namespaced.length ? namespaced : Array.from(doc.getElementsByTagName(tag));
  };

  const trackPoints = getPoints("trkpt");
  const routePoints = getPoints("rtept");
  const points = trackPoints.length >= 2 ? trackPoints : routePoints;

  const coordinates: Coordinate[] = [];
  const elevations: (number | null)[] = [];

  for (const point of points) {
    const lon = Number(point.getAttribute("lon"));
    const lat = Number(point.getAttribute("lat"));
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) continue;

    coordinates.push([lon, lat]);
    const eleNode = Array.from(point.children).find(node => node.localName === "ele");
    const ele = eleNode ? Number(eleNode.textContent) : NaN;
    elevations.push(Number.isFinite(ele) ? ele : null);
  }

  if (coordinates.length < 2) throw new Error("GPX neobsahuje platnou trasu.");
  return { coordinates, elevations };
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function calculateStats(coordinates: Coordinate[], elevations: (number | null)[]): RouteStats {
  let distance = 0;
  for (let i = 1; i < coordinates.length; i += 1) distance += distanceMeters(coordinates[i - 1], coordinates[i]);

  const validElevations = elevations.filter((value): value is number => typeof value === "number");
  if (!validElevations.length) {
    return { distanceKm: distance / 1000, elevationGain: null, minElevation: null, maxElevation: null };
  }

  let gain = 0;
  for (let i = 1; i < elevations.length; i += 1) {
    const previous = elevations[i - 1];
    const current = elevations[i];
    if (previous !== null && current !== null && current > previous) gain += current - previous;
  }

  return {
    distanceKm: distance / 1000,
    elevationGain: gain,
    minElevation: Math.min(...validElevations),
    maxElevation: Math.max(...validElevations),
  };
}

function formatKm(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

export default function RouteMap({ gpxUrl, mapUrl: _mapUrl, name, laps = 1, interactive = true, mapStyle = "standard", showInfo = true }: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const routeSvgRef = useRef<SVGSVGElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [stats, setStats] = useState<RouteStats | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let alive = true;
    let map: MapLibreMap | null = null;
    let drawRoute: (() => void) | null = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    const handleResize = () => {
      if (alive && map) map.resize();
    };
    window.addEventListener("resize", handleResize);

    const load = async () => {
      try {
        const ml = await import("maplibre-gl");
        if (!alive || !element) return;

        const response = await fetch(
          "/api/routes/gpx?url=" + encodeURIComponent(gpxUrl),
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error("GPX se nepodařilo načíst.");

        const text = await response.text();
        if (!alive) return;

        const parsed = parseGpx(text);
        const requestedLaps = Number(laps);
        const lapCount = Number.isFinite(requestedLaps)
          ? Math.min(10, Math.max(1, Math.floor(requestedLaps)))
          : 1;
        const routeLines = lapCount === 1
          ? [parsed.coordinates]
          : Array.from({ length: lapCount }, () => parsed.coordinates);
        const routePoints = routeLines.flat();
        const routeStats = calculateStats(parsed.coordinates, parsed.elevations);
        setStats({
          ...routeStats,
          distanceKm: routeStats.distanceKm * lapCount,
          elevationGain: routeStats.elevationGain === null ? null : routeStats.elevationGain * lapCount,
        });

        const bounds = new ml.LngLatBounds(routePoints[0], routePoints[0]);
        routePoints.forEach(point => bounds.extend(point));

        map = new ml.Map({
          container: element,
          style: ROUTE_MAP_STYLE as any,
          center: [bounds.getCenter().lng, bounds.getCenter().lat],
          zoom: 13,
          maxZoom: 19,
          attributionControl: { compact: true },
        });

        mapRef.current = map;
        if (interactive) {
          map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
          map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
        }

        const onMapError = (event: { error?: { message?: string } }) => {
          console.warn("Route map error:", event.error?.message || event.error || event);
        };
        map.on("error", onMapError);

        const updateRouteOverlay = () => {
          if (!alive || !map || !routeSvgRef.current) return;
          const svg = routeSvgRef.current;
          svg.setAttribute("viewBox", `0 0 ${element.clientWidth} ${element.clientHeight}`);
          const points = parsed.coordinates.map(point => {
            const projected = map!.project(point);
            return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
          }).join(" ");
          svg.querySelectorAll<SVGPolylineElement>(".route-overlay-line").forEach(line => line.setAttribute("points", points));
          const first = map!.project(routePoints[0]);
          const last = map!.project(routePoints[routePoints.length - 1]);
          const start = svg.querySelector<SVGCircleElement>(".route-overlay-start");
          const end = svg.querySelector<SVGCircleElement>(".route-overlay-end");
          const startLabel = svg.querySelector<SVGTextElement>(".route-overlay-start-label");
          const endLabel = svg.querySelector<SVGTextElement>(".route-overlay-end-label");
          if (start) { start.setAttribute("cx", String(first.x)); start.setAttribute("cy", String(first.y)); }
          if (end) { end.setAttribute("cx", String(last.x)); end.setAttribute("cy", String(last.y)); }
          if (startLabel) { startLabel.setAttribute("x", String(first.x)); startLabel.setAttribute("y", String(first.y - 12)); }
          if (endLabel) { endLabel.setAttribute("x", String(last.x)); endLabel.setAttribute("y", String(last.y - 12)); }
        };

        drawRoute = () => {
          if (!alive || !map || !map.isStyleLoaded() || map.getSource("route")) {
            updateRouteOverlay();
            return;
          }

          try {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: lapCount === 1
                  ? { type: "LineString", coordinates: parsed.coordinates }
                  : { type: "MultiLineString", coordinates: routeLines },
              },
            });

            map.addLayer({
              id: "route-glow",
              type: "line",
              source: "route",
              paint: {
                "line-color": "#64d9ff",
                "line-width": 10,
                "line-opacity": 0.22,
                "line-blur": 2,
              },
            });

            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              paint: {
                "line-color": "#35d69a",
                "line-width": 5,
                "line-opacity": 1,
              },
            });

            map.addSource("route-start", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { label: "START" },
                geometry: { type: "Point", coordinates: routePoints[0] },
              },
            });

            map.addSource("route-end", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { label: "CÍL" },
                geometry: { type: "Point", coordinates: routePoints[routePoints.length - 1] },
              },
            });

            map.addLayer({
              id: "route-start",
              type: "circle",
              source: "route-start",
              paint: {
                "circle-radius": 7,
                "circle-color": "#35d69a",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            });

            map.addLayer({
              id: "route-end",
              type: "circle",
              source: "route-end",
              paint: {
                "circle-radius": 7,
                "circle-color": "#ff6b78",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              },
            });

            map.addLayer({
              id: "route-labels",
              type: "symbol",
              source: "route-start",
              layout: {
                "text-field": ["get", "label"],
                "text-size": 11,
                "text-offset": [-1.1, -0.2],
                "text-anchor": "right",
                "text-font": ["Noto Sans Regular"],
              },
              paint: {
                "text-color": "#ffffff",
                "text-halo-color": "#17232d",
                "text-halo-width": 1.5,
              },
            });

            map.addLayer({
              id: "route-end-label",
              type: "symbol",
              source: "route-end",
              layout: {
                "text-field": ["get", "label"],
                "text-size": 11,
                "text-offset": [1.1, 0.2],
                "text-anchor": "left",
                "text-font": ["Noto Sans Regular"],
              },
              paint: {
                "text-color": "#ffffff",
                "text-halo-color": "#17232d",
                "text-halo-width": 1.5,
              },
            });

            const fit = () => {
              if (!alive || !map) return;
              map.resize();
              map.fitBounds(bounds, {
                padding: { top: 78, bottom: 54, left: 34, right: 34 },
                duration: 0,
                maxZoom: 16,
              });
              setState("ready");
              window.clearTimeout(timeout);
            };

            map.on("move", updateRouteOverlay);
            map.on("resize", updateRouteOverlay);
            fit();
            requestAnimationFrame(() => {
              fit();
              updateRouteOverlay();
            });
          } catch (error) {
            console.error("Route geometry render failed:", error);
            if (alive) setState("error");
          }
        };

        map.on("load", () => drawRoute?.());
        map.on("styledata", () => drawRoute?.());
        map.on("idle", () => drawRoute?.());
        window.setTimeout(() => drawRoute?.(), 700);
      } catch (error) {
        if (alive && (error as Error).name !== "AbortError") {
          console.error("Route map load failed:", error);
          setState("error");
        }
      }
    };

    load();

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
      map?.remove();
      mapRef.current = null;
    };
  }, [gpxUrl, laps]);
  return (
    <div className={`route-map-shell route-map-${mapStyle} ${interactive ? "route-map-interactive" : "route-map-preview"}`}>
      <div ref={elementRef} className="route-map" aria-label={"Mapa trasy " + name}>
        <svg ref={routeSvgRef} className="route-map-route-overlay" aria-hidden="true">
          <polyline className="route-overlay-line" fill="none" stroke="#35d69a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <polyline className="route-overlay-line route-overlay-line-inner" fill="none" stroke="#a7ffe4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle className="route-overlay-start" r="7" fill="#35d69a" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle className="route-overlay-end" r="7" fill="#ff6b78" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <text className="route-overlay-start-label" textAnchor="middle">START</text>
          <text className="route-overlay-end-label" textAnchor="middle">CÍL</text>
        </svg>
      </div>

      {showInfo && stats && (
        <div className="route-map-info" aria-label="Informace o trase">
          <strong>{name}</strong>
          <div className="route-map-stats">
            <span><b>{formatKm(stats.distanceKm)}</b> km</span>
            {stats.elevationGain !== null && <span><b>↑ {Math.round(stats.elevationGain)}</b> m</span>}
            {stats.maxElevation !== null && <span><b>{Math.round(stats.minElevation ?? 0)}–{Math.round(stats.maxElevation)}</b> m n. m.</span>}
          </div>
        </div>
      )}

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
    </div>
  );
}
