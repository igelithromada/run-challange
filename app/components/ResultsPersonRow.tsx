"use client";
import { isStrengthActivity } from "../lib/activity";
import { Trophy } from "lucide-react";
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
        <span className="results-person-score">
          <strong>{value}</strong>
          {winner && <small>{person.rank}. místo</small>}
        </span>
      </button>
      <details className="results-person-details">
        <summary>{metric === "badges" ? "Odznaky" : "Podrobnosti"}</summary>
        <dl>
          <div>
            <dt>{strength ? "Celkem opakování" : "Celkem km"}</dt>
            <dd>{strength ? person.repetitions.toLocaleString("cs-CZ") : person.km.toFixed(2)+" km"}</dd>
          </div>
          <div>
            <dt>{strength ? "Zaznamenaný čas" : "Čas"}</dt>
            <dd>{strength && person.minutes === 0 ? "—" : formatResultDuration(person.minutes)}</dd>
          </div>
          {!strength && <div><dt>Průměrné tempo</dt><dd>{formatPace(person.pace)}</dd></div>}
          <div>
            <dt>Aktivity</dt>
            <dd>{person.count}</dd>
          </div>
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
