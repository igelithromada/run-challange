"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { parseActivityDate } from "../lib/runData";
import type { ChartRun } from "../lib/progressChart";
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monday = (d: Date) => {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
};
export default function ActivityCalendar({ runs }: { runs: ChartRun[] }) {
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(() => key(new Date()));
  const today = new Date(),
    last = monday(today);
  last.setDate(last.getDate() + offset * 7);
  const start = new Date(last);
  start.setDate(start.getDate() - 77);
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const totals = useMemo(() => {
    const result = new Map<string, { km: number; count: number }>();
    for (const run of runs) {
      const d = parseActivityDate(run.timestamp),
        km = Number(run.km);
      if (!d || d > new Date() || !Number.isFinite(km) || km <= 0) continue;
      const date = key(d),
        value = result.get(date) || { km: 0, count: 0 };
      result.set(date, { km: value.km + km, count: value.count + 1 });
    }
    return result;
  }, [runs]);
  const months: { label: string; start: number; span: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const date = days[i * 7],
      label = date.toLocaleDateString("cs-CZ", { month: "short" });
    const prev = months.at(-1);
    if (prev?.label === label) prev.span++;
    else months.push({ label, start: i + 1, span: 1 });
  }
  const value = totals.get(selected) || { km: 0, count: 0 };
  const visible = days.filter((d) => d <= today),
    activeDays = visible.filter((d) => totals.has(key(d))).length,
    totalKm = visible.reduce((s, d) => s + (totals.get(key(d))?.km || 0), 0);
  const selectPeriod = (delta: number) => {
    setOffset((v) => v + delta);
    const d = new Date(last);
    d.setDate(d.getDate() + delta * 7);
    setSelected(key(d));
  };
  return (
    <section
      className="tile activity-calendar-card"
      aria-labelledby="activity-calendar-title"
    >
      <div className="progress-section-title">
        <CalendarDays />
        <div>
          <h2 id="activity-calendar-title">Kalendář aktivit</h2>
          <p>Klepni na den pro vzdálenost a počet aktivit.</p>
        </div>
      </div>
      <div className="activity-calendar-nav">
        <button
          type="button"
          className="ui-icon-button"
          aria-label="Předchozích 12 týdnů"
          onClick={() => selectPeriod(-12)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {start.toLocaleDateString("cs-CZ", {
            day: "numeric",
            month: "numeric",
          })}{" "}
          –{" "}
          {visible
            .at(-1)
            ?.toLocaleDateString("cs-CZ", {
              day: "numeric",
              month: "numeric",
              year: "numeric",
            })}
        </span>
        <button
          type="button"
          className="ui-icon-button"
          aria-label="Dalších 12 týdnů"
          disabled={offset === 0}
          onClick={() => selectPeriod(12)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="activity-calendar-months" aria-hidden="true">
        {months.map((m) => (
          <span
            key={m.start}
            style={{ gridColumn: `${m.start} / span ${m.span}` }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className="activity-calendar-body">
        <div className="activity-calendar-labels" aria-hidden="true">
          {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div
          className="activity-calendar-cells"
          role="group"
          aria-label="Aktivity za 12 týdnů"
        >
          {days.map((d) => {
            const date = key(d),
              km = totals.get(date)?.km || 0;
            return (
              <button
                type="button"
                key={date}
                disabled={date > key(today)}
                className={`calendar-heat-cell heat-${km === 0 ? 0 : km < 3 ? 1 : km < 7 ? 2 : km < 12 ? 3 : 4}${date === key(today) ? " is-today" : ""}`}
                aria-pressed={date === selected}
                aria-label={`${d.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${km.toLocaleString("cs-CZ")} km`}
                onClick={() => setSelected(date)}
              />
            );
          })}
        </div>
      </div>
      <div className="activity-calendar-scale">
        <span>0 km</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={`heat-${i}`} />
        ))}
        <span>12+ km</span>
      </div>
      <output className="activity-calendar-detail">
        <strong>
          {new Date(selected + "T12:00:00").toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </strong>
        <span>
          {value.km.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} km ·{" "}
          {value.count} aktivit
        </span>
      </output>
      <p className="chart-hint">
        Za zobrazené období: {activeDays} aktivních dní ·{" "}
        {totalKm.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km
      </p>
    </section>
  );
}
