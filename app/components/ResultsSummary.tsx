"use client";
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
      <div className="results-overview-main">
        <div>
          <span>
            {metric === "badges"
              ? "Odznaky celkem"
              : metric === "tempo"
                ? "Průměrné tempo"
                : strength ? "Celkem opakování" : "Celkem km"}
          </span>
          <strong>
            {metric === "badges"
              ? badges
              : metric === "tempo"
                ? formatPace(totals.pace)
                : strength ? totals.repetitions.toLocaleString("cs-CZ") : `${totals.km.toFixed(2)} km`}
          </strong>
        </div>
        <p>
          Účastníci: {count}
          <br />
          Aktivity: {totals.count}
        </p>
      </div>
      <details className="results-summary-details">
        <summary>Podrobný souhrn</summary>
        <dl>
          <div>
            <dt>{strength ? "Celkem opakování" : "Celkem km"}</dt>
            <dd>{strength ? totals.repetitions.toLocaleString("cs-CZ") : totals.km.toFixed(2)+" km"}</dd>
          </div>
          <div>
            <dt>{strength ? "Zaznamenaný čas" : "Čas"}</dt>
            <dd>{strength && totals.minutes === 0 ? "—" : formatResultDuration(totals.minutes)}</dd>
          </div>
          {!strength && <div><dt>Průměrné tempo</dt><dd>{formatPace(totals.pace)}</dd></div>}
          <div>
            <dt>Aktivity</dt>
            <dd>{totals.count}</dd>
          </div>
          <div>
            <dt>Účastníci</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>Odznaky</dt>
            <dd>{badges}</dd>
          </div>
        </dl>
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
