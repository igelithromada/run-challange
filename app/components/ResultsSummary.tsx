"use client";
import RecordCard, { RecordMetrics } from "./RecordCard";
import Metric from "./Metric";
import { Award, Gauge, ListChecks, MapPin, Users } from "lucide-react";
import { isStrengthActivity } from "../lib/activity";
import { activityMetrics, formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { type ResultPerson } from "../lib/results";
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
    <RecordCard
      className="results-overview"
      aria-label={mine ? "Souhrn mých výsledků" : "Souhrn všech výsledků"}
    >
      <RecordMetrics>
        {metric === "badges" ? <Metric icon={<Award/>} label="Odznaky celkem" tone="award" value={badges}/>
          : <Metric {...(metric === "tempo" ? pace : distance)} />}
        <Metric icon={<ListChecks/>} label="Aktivity" tone="count" value={totals.count}/>
        <Metric icon={<Users/>} label="Účastníci" tone="count" value={count}/>
      </RecordMetrics>
      <details className="results-summary-details"><summary>Podrobný souhrn</summary>
        <RecordMetrics layout="summary">
          <Metric {...distance}/>
          <Metric label="Čas" tone="time" value={strength && totals.minutes === 0 ? "—" : formatCompactActivityTime(totals.minutes)}/>
          {!strength && <Metric {...pace}/>}
          <Metric icon={<Award/>} label="Odznaky" tone="award" value={badges}/>
        </RecordMetrics>
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
          <RecordMetrics layout="summary">
            {(people[0]?.awards || activityAwards([], type)).map(award =>
              <Metric key={award.id} icon={<Award/>} tone="award" label={award.title} unit="×"
                value={people.reduce((sum, person) => sum + (person.awards.find(item => item.id === award.id)?.count || 0), 0)}/>
            )}
          </RecordMetrics>
        </details>
      )}
    </RecordCard>
  );
}
