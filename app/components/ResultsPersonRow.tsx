"use client";
import UserAvatar from "./UserAvatar";
import { isStrengthActivity } from "../lib/activity";
import RecordCard, { RecordMetrics } from "./RecordCard";
import Metric from "./Metric";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import { MapPin, Gauge, ListChecks, Trophy } from "lucide-react";
import { formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { type ResultPerson } from "../lib/results";
export default function ResultsPersonRow({
  person,
  type = "běh",
  metric,
  alpha,
  mine,
  winner,
  onOpen,
}: {
  person: ResultPerson; type?:string;
  metric: "km" | "tempo" | "repetitions";
  alpha: boolean;
  mine: boolean;
  winner: boolean;
  onOpen: () => void;
}) {
  const strength = isStrengthActivity(type);
  const value = metric === "tempo" ? person.pace > 0 ? formatCompactActivityTime(person.pace) : "—"
    : strength ? formatMetricNumber(person.repetitions, 0) : formatMetricNumber(person.km);
  const unit = metric === "tempo" ? person.pace > 0 ? "/km" : undefined
    : strength ? "opakování" : "km";
  return (
    <RecordCard
      className={`results-person${winner ? ` is-winner rank-${person.rank}` : ""}${mine ? " is-mine" : ""}`}
    >
      <button
        type="button"
        className="results-person-open"
        onClick={onOpen}
        aria-label={`Profil ${person.name}`}
      >
        <span className="results-person-rank">
          {alpha ? null : winner ? <Trophy size={17} /> : person.rank}
        </span>
        <UserAvatar name={person.name} url={person.avatarUrl}/>
        <span className="results-person-name">
          <strong>
            {person.name}
            {mine ? " · ty" : ""}
          </strong>
          <small>
            {metric === "tempo"
                ? `${person.km.toFixed(2)} km`
                : `Aktivity: ${person.count}`}
          </small>
        </span>
      </button>
      <RecordMetrics>
        <Metric icon={metric === "tempo" ? <Gauge/> : strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={metric === "tempo" ? "Tempo" : strength ? "Opakování" : "Vzdálenost"} tone={metric === "tempo" ? "pace" : strength ? "repetitions" : "distance"} value={value} unit={unit}/>
        <Metric icon={<ListChecks/>} label="Aktivity" tone="count" value={person.count}/>
        <Metric label="Čas" tone="time" value={strength && person.minutes === 0 ? "—" : formatCompactActivityTime(person.minutes)}/>
      </RecordMetrics>
      <details className="results-person-details">
        <summary>Podrobnosti</summary>
        <RecordMetrics layout="summary">
          <Metric icon={strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={strength ? "Celkem opakování" : "Celkem km"} tone={strength ? "repetitions" : "distance"} value={strength ? formatMetricNumber(person.repetitions, 0) : formatMetricNumber(person.km)} unit={strength ? undefined : "km"}/>
          {!strength && <Metric label="Průměrné tempo" tone="pace" value={person.pace > 0 ? formatCompactActivityTime(person.pace) : "—"} unit={person.pace > 0 ? "/km" : undefined}/>}
        </RecordMetrics>
      </details>
    </RecordCard>
  );
}
