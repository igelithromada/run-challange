import { ArrowDown, Award, CalendarDays, Shield, Trophy } from "lucide-react";
import { BADGE_POINTS, DAILY_ACTIVITY_POINTS, type ActivityPoints } from "../lib/activityPoints";

const number = new Intl.NumberFormat("cs-CZ");
const counted = (value: number, forms: readonly [string, string, string]) =>
  `${number.format(value)} ${forms[value === 1 ? 0 : value >= 2 && value <= 4 ? 1 : 2]}`;
const points = (value: number) => counted(value, ["bod", "body", "bodů"]);

export function LevelShield({ level, tone }: { level: number; tone: ActivityPoints["rank"]["tone"] }) {
  return <span className="level-shield" data-level-tone={tone} aria-hidden="true">
    <Shield strokeWidth={1.6} />
    <b>{number.format(level)}</b>
  </span>;
}

export default function ActivityPointSummary({ score }: { score: ActivityPoints }) {
  const { level, levelStart, nextLevelAt, rank, total } = score;
  const sources = [
    { label: "Aktivita", value: score.activeDays, forms: ["aktivní den", "aktivní dny", "aktivních dní"] as const,
      amount: score.dailyPoints, note: `${points(DAILY_ACTIVITY_POINTS)} za první aktivitu dne`, icon: <CalendarDays />, tone: "days" },
    { label: "Odznaky", value: score.badges, forms: ["odznak", "odznaky", "odznaků"] as const,
      amount: score.badgePoints, note: `${points(BADGE_POINTS)} za každý odznak`, icon: <Award />, tone: "badges" },
    { label: "Úspěchy", value: score.achievements, forms: ["úspěch", "úspěchy", "úspěchů"] as const,
      amount: score.achievementPoints, note: "Za dosažení milníku", icon: <Trophy />, tone: "achievements" },
  ];
  return <div className="activity-point-summary">
    <ul className="activity-point-sources">
      {sources.map(source => <li key={source.tone} data-point-tone={source.tone}>
        <span className="activity-point-source-icon" aria-hidden="true">{source.icon}</span>
        <strong>{source.label}</strong>
        <span>{counted(source.value, source.forms)}</span>
        <b>{points(source.amount)}</b>
        <small>{source.note}</small>
      </li>)}
    </ul>
    <div className="activity-point-connector" aria-hidden="true"><ArrowDown /></div>
    <div className="activity-point-total"><span>Celkové body</span><strong>{number.format(total)}</strong></div>
    <ArrowDown className="activity-point-arrow" aria-hidden="true" />
    <div className="activity-point-level">
      <div className="activity-point-level-heading">
        <LevelShield level={level} tone={rank.tone}/>
        <div><strong>Úroveň {number.format(level)}</strong><span>{rank.name}</span></div>
      </div>
      <progress value={total - levelStart} max={nextLevelAt - levelStart}
        aria-label={`Postup do úrovně ${level + 1}`} aria-valuetext={`Zbývá ${points(nextLevelAt - total)}`} />
      <small>Do úrovně {number.format(level + 1)} zbývá {points(nextLevelAt - total)}.</small>
    </div>
  </div>;
}
