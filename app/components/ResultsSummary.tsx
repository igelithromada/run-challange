"use client";
import Metric from "./Metric";
import { Award, Gauge, ListChecks, MapPin, Users } from "lucide-react";
import { isStrengthActivity } from "../lib/activity";
import { activityMetrics, formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { formatResultDuration, type ResultPerson } from "../lib/results";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
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
  const distance = {
    icon: strength ? <ActivityTypeIcon type={type}/> : <MapPin/>,
    label: strength ? "Celkem opakování" : "Vzdálenost",
    tone: strength ? "repetitions" as const : "distance" as const,
    value: strength ? formatMetricNumber(totals.repetitions, 0) : formatMetricNumber(totals.km),
    unit: strength ? undefined : "km",
  };
  const pace = {
    icon: <Gauge/>,
    label: "Průměrné tempo",
    tone: "pace" as const,
    value: totals.pace > 0 ? formatCompactActivityTime(totals.pace) : "—",
    unit: totals.pace > 0 ? "/km" : undefined,
  };
  return (
    <section
      className="results-overview"
      aria-label={mine ? "Souhrn mých výsledků" : "Souhrn všech výsledků"}
    >
      <div data-metric-layout="row" className="app-metric-grid results-summary-metrics">
        {metric === "badges" ? <Metric icon={<Award/>} label="Odznaky celkem" tone="award" value={badges}/>
          : <Metric {...(metric === "tempo" ? pace : distance)} />}
        <Metric icon={<ListChecks/>} label="Aktivity" tone="count" value={totals.count}/>
        <Metric icon={<Users/>} label="Účastníci" tone="count" value={count}/>
      </div>
      <details className="results-summary-details"><summary>Podrobný souhrn</summary>
        <div data-metric-layout="summary" className="app-metric-grid">
          <Metric {...distance}/>
          <Metric label="Čas" tone="time" value={strength && totals.minutes === 0 ? "—" : formatResultDuration(totals.minutes)}/>
          {!strength && <Metric {...pace}/>}
          <Metric icon={<Award/>} label="Odznaky" tone="award" value={badges}/>
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
