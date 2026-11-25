import { ArrowDown, Award, Shield, Trophy } from "lucide-react";
import { BADGE_POINTS, pointsForAward, type ActivityPoints } from "../lib/activityPoints";

import type { Award as EarnedAward } from "../lib/awards";
import { AwardGlyph } from "./AwardMetrics";

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

export default function ActivityPointSummary({ score, recordAwards }: {
  score: ActivityPoints; recordAwards?: EarnedAward[] | null;
}) {
  const { level, levelStart, nextLevelAt, rank, total } = score;
  const sources = [
    { label: "Odznaky", value: score.badges, forms: ["odznak", "odznaky", "odznaků"] as const,
      amount: score.badgePoints, note: `${points(BADGE_POINTS)} za každý odznak`, icon: <Award />, tone: "badges" },
    { label: "Úspěchy", value: score.achievements, forms: ["úspěch", "úspěchy", "úspěchů"] as const,
      amount: score.achievementPoints, note: "Za dosažení milníku", icon: <Trophy />, tone: "achievements" },
  ];
  const recordMode = recordAwards !== undefined;
  const earnedPoints = recordAwards?.reduce((sum, award) => sum + award.count * pointsForAward(award), 0) ?? 0;
  const visibleSources = sources.map(source => ({
    ...source,
    awards: recordAwards?.filter(award => award.repeatable === (source.tone === "badges")) ?? [],
  })).filter(source => recordMode ? source.awards.length > 0 : source.value > 0);

  return <div className="activity-point-summary">
    {recordAwards === null && <p className="activity-point-empty">Ocenění za tento záznam se nepodařilo načíst.</p>}
    {recordAwards?.length === 0 && <p className="activity-point-empty">Za tento záznam nebyl získán žádný odznak ani úspěch.</p>}
    {visibleSources.length > 0 && <>
      <ul className="activity-point-sources" data-branches={visibleSources.length}>
        {visibleSources.map(source => <li key={source.tone} data-point-tone={source.tone}>
          <div className="activity-point-source-heading">
            <span className="activity-point-source-icon" aria-hidden="true">{source.icon}</span>
            <strong>{source.label}</strong>
          </div>
          {recordMode ? (
            <ul className="activity-point-source-card record-point-awards">
              {source.awards.map(award => (
                <li key={award.id}>
                  <AwardGlyph id={award.id}/>
                  <span>{award.title}</span>
                  <b>+{points(award.count * pointsForAward(award))}</b>
                </li>
              ))}
            </ul>
          ) : (
            <div className="activity-point-source-card">
              <span>{counted(source.value, source.forms)}</span>
              <b>{points(source.amount)}</b>
              <small>{source.note}</small>
            </div>
          )}
        </li>)}
      </ul>
      <div className="activity-point-connector" data-branches={visibleSources.length} aria-hidden="true"><ArrowDown /></div>
      {recordMode && <>
        <div className="activity-point-total"><span>Za tento záznam</span><strong>+{points(earnedPoints)}</strong></div>
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
        <strong>{points(total)}</strong>
        <span>{points(nextLevelAt)}</span>
      </div>
      <progress value={total - levelStart} max={nextLevelAt - levelStart}
        aria-label={`Postup do úrovně ${level + 1}`} aria-valuetext={`Zbývá ${points(nextLevelAt - total)}`} />
      <small>Do úrovně {number.format(level + 1)} zbývá {points(nextLevelAt - total)}.</small>
    </div>
  </div>;
}
