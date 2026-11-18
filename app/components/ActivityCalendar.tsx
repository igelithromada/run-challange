"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { activityAmount, activityUnit } from "../lib/activity";
import { parseActivityDate } from "../lib/runData";
import type { ChartRun } from "../lib/progressChart";

const key = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDay = (date: Date) => date.toLocaleDateString("cs-CZ", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const formatAmount = (amount: number) => amount.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

export default function ActivityCalendar({ runs, activityType = "běh" }: { runs: ChartRun[]; activityType?: string }) {
  const unit = activityUnit(activityType);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(() => key(new Date()));
  const today = new Date();
  const todayKey = key(today);
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12);
  const monthLabel = month.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => week * 7 + day - firstWeekday + 1)
  );
  const totals = useMemo(() => {
    const result = new Map<string, { amount: number; count: number }>();
    for (const run of runs) {
      const date = parseActivityDate(run.timestamp);
      const amount = activityAmount(run);
      if (!date || date > new Date() || amount <= 0) continue;
      const dateKey = key(date);
      const previous = result.get(dateKey);
      result.set(dateKey, { amount: (previous?.amount ?? 0) + amount, count: (previous?.count ?? 0) + 1 });
    }
    return result;
  }, [runs]);
  const value = totals.get(selected);
  const prefix = key(month).slice(0, 7);
  const monthDays = [...totals].filter(([date]) => date.startsWith(prefix));
  const total = monthDays.reduce((sum, [, day]) => sum + day.amount, 0);

  function selectMonth(delta: number) {
    const nextOffset = offset + delta;
    setOffset(nextOffset);
    const next = new Date(today.getFullYear(), today.getMonth() + nextOffset, 1, 12);
    const firstActive = [...totals.keys()].filter(date => date.startsWith(key(next).slice(0, 7))).sort()[0];
    setSelected(nextOffset === 0 ? todayKey : firstActive ?? key(next));
  }

  return <section className="tile activity-calendar-card" aria-labelledby="activity-calendar-title">
    <div className="progress-section-title">
      <CalendarDays/><div><h2 id="activity-calendar-title">Kalendář aktivit</h2></div>
    </div>
    <div className="trainer-month-nav activity-month-nav">
      <button type="button" className="ui-icon-button" aria-label="Předchozí měsíc" onClick={() => selectMonth(-1)}><ChevronLeft size={18}/></button>
      <strong aria-live="polite">{monthLabel}</strong>
      <button type="button" className="ui-icon-button" aria-label="Další měsíc" disabled={offset === 0} onClick={() => selectMonth(1)}><ChevronRight size={18}/></button>
    </div>
    <div className="trainer-calendar-weekdays" aria-hidden="true">
      {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map(day => <span key={day}>{day}</span>)}
    </div>
    <div className="trainer-calendar activity-month-calendar" role="group" aria-label={`Aktivity za ${monthLabel}`}>
      {weeks.map((week, index) => <div className="trainer-calendar-week" key={index}>
        {week.map(day => {
          if (day < 1 || day > daysInMonth) return <span key={day} aria-hidden="true"/>;
          const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
          const dateKey = key(date);
          const activity = totals.get(dateKey);
          return <button key={day} type="button" disabled={dateKey > todayKey}
            className={`trainer-calendar-day${dateKey === selected ? " selected" : ""}${activity ? " has-activity" : ""}`}
            aria-current={dateKey === todayKey ? "date" : undefined}
            aria-pressed={dateKey === selected}
            aria-label={`${formatDay(date)}, ${formatAmount(activity?.amount ?? 0)} ${unit}`}
            onClick={() => setSelected(dateKey)}>
            <span>{day}</span>{activity && <small>{formatAmount(activity.amount)}</small>}
          </button>;
        })}
      </div>)}
    </div>
    <output className="activity-calendar-detail">
      <strong>{formatDay(new Date(selected + "T12:00:00"))}</strong>
      <span>{formatAmount(value?.amount ?? 0)} {unit} · {value?.count ?? 0} aktivit</span>
    </output>
    <p className="chart-hint">Za měsíc: {monthDays.length} aktivních dní · {formatAmount(total)} {unit}</p>
  </section>;
}
