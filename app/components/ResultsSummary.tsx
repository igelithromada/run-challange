"use client";
import RecordCard, { RecordMetrics } from "./RecordCard";
import Metric from "./Metric";
import { Gauge, ListChecks, MapPin, Users } from "lucide-react";
import { isStrengthActivity } from "../lib/activity";
import { activityMetrics, formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import type { ActivityType, RunData } from "../types";
export default function ResultsSummary({
  runs,
  metric,
  type,
  mine,
}: {
  runs: RunData[];
  metric: "km" | "tempo" | "repetitions";
  type: ActivityType;
  mine: boolean;
}) {
  const strength = isStrengthActivity(type);
  const totals = activityMetrics(runs),
    count = new Set(runs.map((run) => run.uid)).size;
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
        <Metric {...(metric === "tempo" ? pace : distance)} />
        <Metric icon={<ListChecks/>} label="Aktivity" tone="count" value={totals.count}/>
        <Metric icon={<Users/>} label="Účastníci" tone="count" value={count}/>
      </RecordMetrics>
      <details className="results-summary-details"><summary>Podrobný souhrn</summary>
        <RecordMetrics layout="summary">
          <Metric {...distance}/>
          <Metric label="Čas" tone="time" value={strength && totals.minutes === 0 ? "—" : formatCompactActivityTime(totals.minutes)}/>
          {!strength && <Metric {...pace}/>}
        </RecordMetrics>
      </details>
    </RecordCard>
  );
}
