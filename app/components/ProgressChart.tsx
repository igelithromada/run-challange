"use client";
import { isStrengthActivity, activityUnit } from "../lib/activity";
import { useMemo, useState } from "react";
import {
  progressPoints,
  nearestProgressPoint,
  type ChartRun,
} from "../lib/progressChart";
const key = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const km = (value: number) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
const duration = (minutes: number) => {
  const s = Math.round(minutes * 60);
  return s >= 3600
    ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
    : `${Math.floor(s / 60)} min ${s % 60} s`;
};
const pace = (minutes: number, distance: number) => {
  if (minutes <= 0 || distance <= 0) return "—";
  const seconds = Math.round((minutes / distance) * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /km`;
};
export default function ProgressChart({
  runs,
  activityType,
  loading = false,
  error = false,
}: {
  runs: ChartRun[];
  activityType: string;
  loading?: boolean;
  error?: boolean;
}) {
  const strength = isStrengthActivity(activityType), unit = activityUnit(activityType);
  const [from, setFrom] = useState(() =>
    key(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [to, setTo] = useState(() => key(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const points = useMemo(
    () => progressPoints(runs, from, to),
    [runs, from, to],
  );
  const start = Date.parse(from + "T00:00:00"),
    end = Math.min(Date.parse(to + "T23:59:59.999"), Date.now());
  const max = points.at(-1)?.totalKm || 1;
  const px = (time: number) =>
      2 + ((time - start) / Math.max(1, end - start)) * 96,
    py = (value: number) => 94 - (value / max) * 88;
  const activeIndex = Math.max(
      0,
      selectedId
        ? points.findIndex((p) => p.id === selectedId)
        : points.length - 1,
    ),
    active = points[activeIndex];
  const select = (index: number) => {
    if (points[index]) setSelectedId(points[index].id);
  };
  const invalid = !!from && !!to && from > to;
  const date = (time: number) =>
    new Date(time).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
    });
  return (
    <section
      className="tile progress-chart-section"
      aria-labelledby="progress-chart-title"
    >
      <div className="progress-section-title">
        <div>
          <h2 id="progress-chart-title">{strength ? "Opakování v čase" : "Kilometry v čase"}</h2>
          <p>
            Součet {strength ? "opakování" : "kilometrů"} · {activityType}.
            Každý bod představuje jednu aktivitu.
          </p>
        </div>
      </div>
      <div className="progress-chart-period">
        <label>
          Od data
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setSelectedId(null);
            }}
          />
        </label>
        <label>
          Do data
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setSelectedId(null);
            }}
          />
        </label>
      </div>
      {error && runs.length > 0 && (
        <p role="status">
          Spojení se nepodařilo obnovit. Zobrazuji poslední načtené aktivity.
        </p>
      )}
      {!from || !to ? (
        <p role="status">Vyber datum od a do.</p>
      ) : invalid ? (
        <p role="status">Datum od nesmí být později než datum do.</p>
      ) : loading && runs.length === 0 ? (
        <p role="status">Načítám aktivity…</p>
      ) : error && runs.length === 0 ? (
        <p role="status">Aktivity se nepodařilo načíst. Obnov stránku.</p>
      ) : !points.length ? (
        <p role="status">V tomto období zatím nemáš žádnou aktivitu.</p>
      ) : (
        <>
          <div className="progress-chart-summary">
            <strong>{km(max)} {unit}</strong>
            <span>
              {points.length} aktivit ·{" "}
              {points.at(-1)?.completeTime
                ? duration(points.at(-1)?.totalMinutes || 0)
                : "neúplné údaje o čase"}
            </span>
          </div>
          <p className="chart-hint">
            Posouvej prst po grafu pro detail aktivity.
          </p>
          <div className="progress-chart-layout">
            <div className="progress-chart-y" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((r) => (
                <span key={r}>{km(max * r)}</span>
              ))}
            </div>
            <svg
              className="progress-distance-chart"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="slider"
              tabIndex={0}
              aria-label="Pokrok po jednotlivých aktivitách"
              aria-valuemin={1}
              aria-valuemax={points.length}
              aria-valuenow={activeIndex + 1}
              aria-valuetext={
                active
                  ? `${date(active.time)}, aktivita ${km(active.km)} ${unit}, celkem ${km(active.totalKm)} ${unit}`
                  : undefined
              }
              onKeyDown={(event) => {
                let index = activeIndex;
                if (event.key === "ArrowRight") index++;
                else if (event.key === "ArrowLeft") index--;
                else if (event.key === "Home") index = 0;
                else if (event.key === "End") index = points.length - 1;
                else return;
                event.preventDefault();
                select(Math.max(0, Math.min(points.length - 1, index)));
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const rect = event.currentTarget.getBoundingClientRect();
                select(
                  nearestProgressPoint(
                    points,
                    start,
                    end,
                    (((event.clientX - rect.left) / rect.width) * 100 - 2) / 96,
                    (event.clientY - rect.top) / rect.height,
                  ),
                );
              }}
              onPointerMove={(event) => {
                if (
                  event.pointerType === "mouse" ||
                  event.currentTarget.hasPointerCapture(event.pointerId)
                ) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  select(
                    nearestProgressPoint(
                      points,
                      start,
                      end,
                      (((event.clientX - rect.left) / rect.width) * 100 - 2) /
                        96,
                      (event.clientY - rect.top) / rect.height,
                    ),
                  );
                }
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                <line
                  key={r}
                  x1="2"
                  x2="98"
                  y1={py(max * r)}
                  y2={py(max * r)}
                  stroke="currentColor"
                  strokeOpacity=".14"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polyline
                points={`2,94 ${points.map((p) => `${px(p.time)},${py(p.totalKm)}`).join(" ")}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((p) => (
                <ellipse
                  key={p.id}
                  cx={px(p.time)}
                  cy={py(p.totalKm)}
                  rx=".65"
                  ry="1.1"
                  fill="currentColor"
                />
              ))}
              {active && (
                <>
                  <line
                    x1={px(active.time)}
                    x2={px(active.time)}
                    y1="2"
                    y2="94"
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <ellipse
                    cx={px(active.time)}
                    cy={py(active.totalKm)}
                    rx="1.3"
                    ry="2.2"
                    fill="var(--ui-text)"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>
          </div>
          <div className="progress-chart-x" aria-hidden="true">
            <span>{date(start)}</span>
            <span>{date(start + (end - start) / 2)}</span>
            <span>{date(end)}</span>
          </div>
          {active && (
            <output className="chart-readout progress-chart-readout">
              <strong>
                {new Date(active.time).toLocaleString("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              <div>
                <span>
                  Aktivita <b>{km(active.km)} {unit}</b>
                </span>
                <span>
                  Čas{" "}
                  <b>{active.minutes > 0 ? duration(active.minutes) : "—"}</b>
                </span>
                {!strength && <span>Tempo <b>{pace(active.minutes, active.km)}</b></span>}
              </div>
              <div>
                <span>
                  Do tohoto bodu <b>{km(active.totalKm)} {unit}</b>
                </span>
                {!strength && <span>
                  Průměrné tempo{" "}
                  <b>
                    {pace(
                      active.completeTime ? active.totalMinutes : 0,
                      active.totalKm,
                    )}
                  </b>
                </span>}
              </div>
            </output>
          )}
        </>
      )}
    </section>
  );
}
