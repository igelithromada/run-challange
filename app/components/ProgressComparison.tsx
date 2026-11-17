"use client";
import { activityUnit, isStrengthActivity } from "../lib/activity";
import { progressComparison } from "../lib/progressComparison";
import type { ActivityType, RunData } from "../types";
export default function ProgressComparison({runs, type}: {runs: RunData[]; type: ActivityType}) {
  const now = new Date(), value = progressComparison(runs, type, now), unit = activityUnit(type);
  const format = (n: number) => n.toLocaleString("cs-CZ", {maximumFractionDigits:isStrengthActivity(type) ? 0 : 1});
  const date = (d: Date) => d.toLocaleDateString("cs-CZ", {day:"numeric",month:"numeric"});
  return <section className="progress-comparison" aria-label="Porovnání měsíců">
    <h2>Jak si vedeš tento měsíc</h2>
    <div className="progress-comparison-values"><div><span>{date(value.start)} – {date(now)}</span><strong>{format(value.current)} {unit}</strong><small>{value.currentCount} aktivit</small></div><div><span>{date(value.previousStart)} – {date(value.previousEnd)}</span><strong>{format(value.previous)} {unit}</strong><small>{value.previousCount} aktivit</small></div></div>
    <p>{value.delta === 0 ? "Stejné množství jako za porovnávané období." : <>{format(Math.abs(value.delta))} {unit} {value.delta > 0 ? "více" : "méně"} než za porovnávané období{value.percent !== null && ` (${format(Math.abs(value.percent))} %)`}.</>}</p>
    <small>Porovnáváme část měsíce do dnešního dne se stejnou částí předchozího měsíce.</small>
  </section>;
}
