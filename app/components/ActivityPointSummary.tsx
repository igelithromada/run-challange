import { ArrowDown, CalendarDays, MapPin, Shield } from "lucide-react";
import { RUN_POINTS, type ActivityPoints, type RecordPoints } from "../lib/activityPoints";

const number = new Intl.NumberFormat("cs-CZ");
const counted = (value: number, forms: readonly [string, string, string]) =>
  `${number.format(value)} ${forms[value === 1 ? 0 : value >= 2 && value <= 4 ? 1 : 2]}`;
const points = (value: number) => counted(value, ["bod", "body", "bodů"]);
const gainedPoints = (value: number) => (value > 0 ? "+" : "") + points(value);

export function LevelShield({ level, tone }: { level: number; tone: ActivityPoints["rank"]["tone"] }) {
  return <span className="level-shield" data-level-tone={tone} aria-hidden="true">
    <Shield strokeWidth={1.6} />
    <b>{number.format(level)}</b>
  </span>;
}

export default function ActivityPointSummary({ score, record }: {
  score: ActivityPoints; record?: RecordPoints | null;
}) {
  const { level, levelStart, nextLevelAt, rank, total } = score;
  const amounts = record ?? score;
  return <div className="activity-point-summary">
    {record === null ? <p className="activity-point-empty">Body se počítají za běhy od {RUN_POINTS.minimumKm} km.</p> : <>
      <ul className="activity-point-sources">
        <li className="activity-point-source-card" data-point-tone="distance">
          <div className="activity-point-source-heading"><span className="activity-point-source-icon"><MapPin aria-hidden="true"/></span><strong>Vzdálenost</strong></div>
          <b>{gainedPoints(amounts.distancePoints)}</b>
        </li>
        <li className="activity-point-source-card" data-point-tone="consistency">
          <div className="activity-point-source-heading"><span className="activity-point-source-icon"><CalendarDays aria-hidden="true"/></span><strong>Pravidelnost</strong></div>
          <b>{gainedPoints(amounts.consistencyPoints)}</b>
        </li>
      </ul>
      <div className="activity-point-connector" data-branches="2" aria-hidden="true"><ArrowDown /></div>
      {record && <>
        <div className="activity-point-total"><span>Za tento běh</span><strong>{gainedPoints(record.distancePoints + record.consistencyPoints)}</strong></div>
        <ArrowDown className="activity-point-arrow" aria-hidden="true" />
      </>}
      <div className="activity-point-level-divider" aria-hidden="true" />
    </>}
    <div className="activity-point-level">
      <div className="activity-point-level-heading">
        <LevelShield level={level} tone={rank.tone}/>
        <div><strong>Úroveň {number.format(level)}</strong><span>{rank.name}</span></div>
      </div>
      <div className="activity-point-progress-values">
        <strong>{points(total)}</strong><span>{points(nextLevelAt)}</span>
      </div>
      <progress value={total - levelStart} max={nextLevelAt - levelStart}
        aria-label={`Postup do úrovně ${level + 1}`} aria-valuetext={`Zbývá ${points(nextLevelAt - total)}`} />
      <small>Do úrovně {number.format(level + 1)} zbývá {points(nextLevelAt - total)}.</small>
      {score.deducted > 0 &&
        <p className="activity-point-deduction">Za pauzy odečteno <b>−{points(score.deducted)}</b></p>}
    </div>
  </div>;
}
