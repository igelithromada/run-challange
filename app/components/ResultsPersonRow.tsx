"use client";
import { isStrengthActivity } from "../lib/activity";
import Metric from "./Metric";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import { MapPin, Clock3, Gauge, ListChecks, Award, Trophy } from "lucide-react";
import { formatPace } from "../lib/activityMetrics";
import { formatResultDuration, type ResultPerson } from "../lib/results";
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
  const value =
    metric === "badges"
      ? `${person.awardCount}×`
      : metric === "tempo"
        ? formatPace(person.pace)
        : strength ? `${person.repetitions.toLocaleString("cs-CZ")}×` : `${person.km.toFixed(2)} km`;
  return (
    <article
      className={`tile activity-card-modern results-person${winner ? ` is-winner rank-${person.rank}` : ""}${mine ? " is-mine" : ""}`}
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
      <div className="app-metric-grid result-measurements">
        <Metric icon={metric === "badges" ? <Award/> : metric === "tempo" ? <Gauge/> : strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={metric === "badges" ? "Odznaky" : metric === "tempo" ? "Tempo" : strength ? "Opakování" : "Vzdálenost"} value={value}/>
        <Metric icon={<ListChecks/>} label="Aktivity" value={person.count}/>
        <Metric icon={<Clock3/>} label="Čas" value={strength && person.minutes === 0 ? "—" : formatResultDuration(person.minutes)}/>
      </div>
      <details className="results-person-details">
        <summary>{metric === "badges" ? "Odznaky" : "Podrobnosti"}</summary>
        <div className="app-metric-grid">
          <Metric icon={strength ? <ActivityTypeIcon type={type} size={19}/> : <MapPin/>} label={strength ? "Celkem opakování" : "Celkem km"} value={strength ? person.repetitions.toLocaleString("cs-CZ") : person.km.toFixed(2)+" km"}/>
          {!strength && <Metric icon={<Gauge/>} label="Průměrné tempo" value={formatPace(person.pace)}/>}
        </div>
        <dl>
          {metric === "badges" &&
            person.awards.map((award) => (
              <div key={award.id}>
                <dt>{award.title}</dt>
                <dd>{award.count}×</dd>
              </div>
            ))}
        </dl>
      </details>
    </article>
  );
}
