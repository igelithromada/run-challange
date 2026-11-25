import { ACTIVITY_TYPES, activityAmount, recordActivityType } from "./activity";
import { activityAwards, type Award, type AwardRun } from "./awards";
import { parseActivityDate } from "./runData";

export const BADGE_POINTS = 2;
export const ACHIEVEMENT_POINTS: Readonly<Record<string, number>> = {
  first: 5,
  km10: 10, km50: 15, km100: 20, km250: 40, month100: 25,
  reps100: 10, reps500: 15, reps1000: 20, reps5000: 40, month1000: 25,
  streak7: 15, activities10: 10, activities50: 25,
};

const ranks = [
  { min: 100, name: "Legenda", tone: "legend" },
  { min: 60, name: "Elita", tone: "elite" },
  { min: 40, name: "Šampion", tone: "champion" },
  { min: 25, name: "Veterán", tone: "veteran" },
  { min: 15, name: "Vytrvalec", tone: "endurance" },
  { min: 10, name: "Aktivní sportovec", tone: "active" },
  { min: 5, name: "Sportovec", tone: "sport" },
  { min: 1, name: "Začátečník", tone: "beginner" },
] as const;

function validActivities(runs: AwardRun[], now: number) {
  const seen = new Set<string>();
  return runs.flatMap(run => {
    if (run.deleting || seen.has(run.id) || !activityAmount(run)) return [];
    const type = ACTIVITY_TYPES.find(type => type === recordActivityType(run));
    const time = parseActivityDate(run.timestamp)?.getTime();
    if (!type || time === undefined || time > now) return [];
    seen.add(run.id);
    return [{ run, time, type }];
  });
}

export function pointsForAward(award: Award): number {
  return award.repeatable ? BADGE_POINTS : ACHIEVEMENT_POINTS[award.id] ?? 0;
}

export function awardsForRecord(runs: AwardRun[], id: string, now = Date.now()) {
  const valid = validActivities(runs, now);
  const target = valid.find(item => item.run.id === id);
  if (!target) return null;
  // Older records establish the baseline. Equal timestamps use a stable ID order.
  const before = valid.filter(item => item.type === target.type && (
    item.time < target.time || (item.time === target.time && item.run.id < id)
  )).map(item => item.run);
  const previous = new Map(activityAwards(before, target.type, now).map(award => [award.id, award.count]));
  return activityAwards([...before, target.run], target.type, now).flatMap(award => {
    const count = award.count - (previous.get(award.id) ?? 0);
    return count > 0 ? [{ ...award, count }] : [];
  });
}

export function activityPoints(runs: AwardRun[], now = Date.now()) {
  const validRuns = validActivities(runs, now).map(item => item.run);
  const awardsByType = Object.fromEntries(ACTIVITY_TYPES.map(type => [type, activityAwards(validRuns, type, now)]));
  const awards = Object.values(awardsByType).flat();
  let badges = 0, achievements = 0, achievementPoints = 0;
  for (const award of awards) {
    if (award.repeatable) badges += award.count;
    else {
      achievements += award.count;
      achievementPoints += award.count * pointsForAward(award);
    }
  }
  const badgePoints = badges * BADGE_POINTS;
  const total = badgePoints + achievementPoints;
  // Level n starts at 10 × n × (n − 1) points.
  const level = Math.floor((1 + Math.sqrt(1 + total * 0.4)) / 2);
  const levelStart = 10 * level * (level - 1);
  const nextLevelAt = 10 * level * (level + 1);
  const rank = ranks.find(item => level >= item.min) ?? ranks[ranks.length - 1];
  return { badges, badgePoints, achievements, achievementPoints, total,
    level, levelStart, nextLevelAt, rank, awardsByType };
}

export type ActivityPoints = ReturnType<typeof activityPoints>;
