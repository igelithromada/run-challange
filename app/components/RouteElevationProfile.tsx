"use client";
import { useMemo, useState } from "react";
import {
  nearestDistance,
  routePointAtDistance,
  profileDisplay,
  type RouteSample,
} from "../lib/routeProfile";
export default function RouteElevationProfile({
  samples,
  gain,
  min,
  max,
  onSelect,
}: {
  samples: RouteSample[];
  gain: number | null;
  min: number | null;
  max: number | null;
  onSelect: (sample: RouteSample) => void;
}) {
  const [selected, setSelected] = useState<RouteSample | null>(null);
  const distance = samples.at(-1)?.distanceKm || 0;
  const displaySamples = useMemo(() => profileDisplay(samples), [samples]);
  if (min === null || max === null || distance <= 0) return null;
  const range = Math.max(1, max - min),
    px = (sample: RouteSample) => (sample.distanceKm / distance) * 100,
    py = (sample: RouteSample) =>
      88 - (((sample.elevation ?? min) - min) / range) * 68;
  const points = displaySamples
    .filter((s) => s.elevation !== null)
    .map((s) => `${px(s).toFixed(3)},${py(s).toFixed(2)}`)
    .join(" ");
  const select = (index: number) => {
    if (index >= 0 && samples[index]) {
      setSelected(samples[index]);
      onSelect(samples[index]);
    }
  };
  const active = selected;
  const selectDistance = (distanceKm: number) => {
    const point = routePointAtDistance(samples, distanceKm);
    if (point) {
      setSelected(point);
      onSelect(point);
    }
  };
  return (
    <div className="route-elevation-profile">
      <div className="route-elevation-header">
        <strong>Výškový profil</strong>
        <span>
          {distance.toFixed(1)} km · {Math.round(min)}–{Math.round(max)} m n. m.
          {gain !== null ? ` · ↑ ${Math.round(gain)} m` : ""}
        </span>
      </div>
      <p className="chart-hint">
        Posouvej prst po profilu a sleduj bod na mapě.
      </p>
      <svg
        className="interactive-route-profile"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="slider"
        tabIndex={0}
        aria-label="Bod na trase podle vzdálenosti"
        aria-valuemin={0}
        aria-valuemax={distance}
        aria-valuenow={active?.distanceKm || 0}
        aria-valuetext={
          active
            ? `${active.distanceKm.toFixed(2)} km, ${active.elevation === null ? "výška neznámá" : `${Math.round(active.elevation)} metrů`}`
            : "Posouvej prst po profilu"
        }
        onKeyDown={(event) => {
          let i = selected ? nearestDistance(samples, selected.distanceKm) : 0;
          if (event.key === "ArrowRight") i++;
          else if (event.key === "ArrowLeft") i--;
          else if (event.key === "Home") i = 0;
          else if (event.key === "End") i = samples.length - 1;
          else return;
          event.preventDefault();
          select(Math.max(0, Math.min(samples.length - 1, i)));
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          selectDistance(
            Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
              distance,
          );
        }}
        onPointerMove={(event) => {
          if (
            event.pointerType === "mouse" ||
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            const rect = event.currentTarget.getBoundingClientRect();
            selectDistance(
              Math.max(
                0,
                Math.min(1, (event.clientX - rect.left) / rect.width),
              ) * distance,
            );
          }
        }}
      >
        <polygon
          points={`0,88 ${points} 100,88`}
          fill="currentColor"
          fillOpacity=".1"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        {active && (
          <>
            <line
              x1={px(active)}
              x2={px(active)}
              y1="8"
              y2="88"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 3"
            />
            {active.elevation !== null && (
              <ellipse
                cx={px(active)}
                cy={py(active)}
                rx="1.3"
                ry="3.5"
                fill="currentColor"
              />
            )}
          </>
        )}
      </svg>
      <div className="route-elevation-axis" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <span key={r}>{(distance * r).toFixed(1)} km</span>
        ))}
      </div>
      <output className="chart-readout route-profile-readout">
        {active
          ? `${active.distanceKm.toFixed(2)} km · ${active.elevation === null ? "Výška není v GPX uvedena" : `${Math.round(active.elevation)} m n. m.`}`
          : "Vyber bod na profilu"}
      </output>
    </div>
  );
}
