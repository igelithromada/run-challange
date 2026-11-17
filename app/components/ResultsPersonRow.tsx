"use client";
import { Trophy } from "lucide-react";
import { formatPace } from "../lib/activityMetrics";
import { formatResultDuration, type ResultPerson } from "../lib/results";
import { cloudinaryImageUrl } from "../lib/imageUrl";
export default function ResultsPersonRow({
  person,
  metric,
  alpha,
  mine,
  winner,
  onOpen,
}: {
  person: ResultPerson;
  metric: "km" | "tempo" | "badges";
  alpha: boolean;
  mine: boolean;
  winner: boolean;
  onOpen: () => void;
}) {
  const value =
    metric === "badges"
      ? `${person.awardCount}×`
      : metric === "tempo"
        ? formatPace(person.pace)
        : `${person.km.toFixed(2)} km`;
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
            <dt>Celkem km</dt>
            <dd>{person.km.toFixed(2)} km</dd>
          </div>
          <div>
            <dt>Čas</dt>
            <dd>{formatResultDuration(person.minutes)}</dd>
          </div>
          <div>
            <dt>Průměrné tempo</dt>
            <dd>{formatPace(person.pace)}</dd>
          </div>
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
