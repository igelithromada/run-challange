"use client";
import Metric from "./Metric";
import { Award, Clock3, Gauge, ListChecks, MapPin, Users } from "lucide-react";
import { isStrengthActivity } from "../lib/activity";
import { activityMetrics, formatPace } from "../lib/activityMetrics";
import { formatResultDuration, type ResultPerson } from "../lib/results";
import { activityAwards } from "../lib/awards";
import type { ActivityType, RunData } from "../types";
export default function ResultsSummary({
  runs,
  people,
  metric,
  type,
  mine,
}: {
  runs: RunData[];
  people: ResultPerson[];
  metric: "km" | "tempo" | "badges" | "repetitions";
  type: ActivityType;
  mine: boolean;
}) {
  const strength = isStrengthActivity(type);
  const totals = activityMetrics(runs),
    count = new Set(runs.map((run) => run.uid)).size,
    badges = people.reduce((sum, p) => sum + p.awardCount, 0);
  return (
    <section
      className="results-overview"
      aria-label={mine ? "Souhrn mých výsledků" : "Souhrn všech výsledků"}
    >
      <div className="app-metric-grid results-summary-metrics">
        <Metric icon={metric === "badges" ? <Award/> : metric === "tempo" ? <Gauge/> : <MapPin/>} label={metric === "badges" ? "Odznaky celkem" : metric === "tempo" ? "Průměrné tempo" : strength ? "Celkem opakování" : "Vzdálenost"} value={metric === "badges" ? badges : metric === "tempo" ? formatPace(totals.pace) : strength ? totals.repetitions.toLocaleString("cs-CZ") : totals.km.toFixed(2)+" km"}/>
        <Metric icon={<ListChecks/>} label="Aktivity" value={totals.count}/>
        <Metric icon={<Users/>} label="Účastníci" value={count}/>
      </div>
      <details className="results-summary-details"><summary>Podrobný souhrn</summary>
        <div className="app-metric-grid">
          <Metric icon={<MapPin/>} label={strength ? "Celkem opakování" : "Vzdálenost"} value={strength ? totals.repetitions.toLocaleString("cs-CZ") : totals.km.toFixed(2)+" km"}/>
          <Metric icon={<Clock3/>} label="Čas" value={strength && totals.minutes === 0 ? "—" : formatResultDuration(totals.minutes)}/>
          {!strength && <Metric icon={<Gauge/>} label="Průměrné tempo" value={formatPace(totals.pace)}/>}
          <Metric icon={<Award/>} label="Odznaky" value={badges}/>
        </div>
      </details>
      {metric === "badges" && (
        <details
          className="results-summary-details community-awards"
          aria-label="Celkové vyhodnocení odznaků"
        >
          <summary>Počty jednotlivých odznaků</summary>
          <p className="chart-hint">
            Vyhodnocení za zvolené období a kategorii. Jednorázové odznaky
            nejvýše 1×, ranní a noční za každou aktivitu.
          </p>
          <dl>
            {(people[0]?.awards || activityAwards([], type)).map((award) => (
              <div key={award.id}>
                <dt>{award.title}</dt>
                <dd>
                  {people.reduce(
                    (sum, p) =>
                      sum +
                      (p.awards.find((a) => a.id === award.id)?.count || 0),
                    0,
                  )}
                  ×
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
