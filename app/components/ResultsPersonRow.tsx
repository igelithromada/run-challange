"use client";
import { isStrengthActivity } from "../lib/activity";
import RecordCard, { RecordMetrics } from "./RecordCard";
import Metric from "./Metric";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import { MapPin, Gauge, ListChecks, Award, Trophy } from "lucide-react";
import { formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { type ResultPerson } from "../lib/results";
import { cloudinaryImageUrl } from "../lib/imageUrl";
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
  metric: "km" | "tempo" | "badges" | "repetitions";
  alpha: boolean;
  mine: boolean;
  winner: boolean;
  onOpen: () => void;
}) {
  const strength = isStrengthActivity(type);
  const value = metric === "badges" ? formatMetricNumber(person.awardCount, 0)
    : metric === "tempo" ? person.pace > 0 ? formatCompactActivityTime(person.pace) : "—"
    : strength ? formatMetricNumber(person.repetitions, 0) : formatMetricNumber(person.km);
  const unit = metric === "badges" ? "×" : metric === "tempo" ? person.pace > 0 ? "/km" : undefined
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
        <span className="activity-avatar">
          {person.avatarUrl ? (
            <img
              src={cloudinaryImageUrl(person.avatarUrl, 96)}
              alt=""
              loading="lazy"
            />
          ) : (
            person.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="results-person-name">
          <strong>
            {person.name}
            {mine ? " · ty" : ""}
          </strong>
          <small>
            {metric === "badges"
              ? `${person.awards.filter((a) => a.count > 0).length} druhů odznaků`
              : metric === "tempo"
                ? `${person.km.toFixed(2)} km`
                : `Aktivity: ${person.count}`}
          </small>
        </span>
      </button>
      <RecordMetrics>
        <Metric icon={metric === "badges" ? <Award/> : metric === "tempo" ? <Gauge/> : strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={metric === "badges" ? "Odznaky" : metric === "tempo" ? "Tempo" : strength ? "Opakování" : "Vzdálenost"} tone={metric === "badges" ? "award" : metric === "tempo" ? "pace" : strength ? "repetitions" : "distance"} value={value} unit={unit}/>
        <Metric icon={<ListChecks/>} label="Aktivity" tone="count" value={person.count}/>
        <Metric label="Čas" tone="time" value={strength && person.minutes === 0 ? "—" : formatCompactActivityTime(person.minutes)}/>
      </RecordMetrics>
      <details className="results-person-details">
        <summary>{metric === "badges" ? "Odznaky" : "Podrobnosti"}</summary>
        <RecordMetrics layout="summary">
          <Metric icon={strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={strength ? "Celkem opakování" : "Celkem km"} tone={strength ? "repetitions" : "distance"} value={strength ? formatMetricNumber(person.repetitions, 0) : formatMetricNumber(person.km)} unit={strength ? undefined : "km"}/>
          {!strength && <Metric label="Průměrné tempo" tone="pace" value={person.pace > 0 ? formatCompactActivityTime(person.pace) : "—"} unit={person.pace > 0 ? "/km" : undefined}/>}
        </RecordMetrics>
        {metric === "badges" && <RecordMetrics layout="summary">
          {person.awards.map(award => <Metric key={award.id} icon={<Award/>} tone="award" label={award.title} value={award.count} unit="×"/>)}
        </RecordMetrics>}
      </details>
    </RecordCard>
  );
}
