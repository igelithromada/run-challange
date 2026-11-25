import { ACTIVITY_TYPES, activityAmount, recordActivityType } from "./activity";
import { activityAwards, type AwardRun } from "./awards";
import { parseActivityDate } from "./runData";

const pragueDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

export const DAILY_ACTIVITY_POINTS = 1;
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

export function activityPoints(runs: AwardRun[], now = Date.now()) {
  const dates = new Set<string>();
  const seen = new Set<string>();
  const validRuns = runs.filter(run => {
    if (run.deleting || seen.has(run.id) || !ACTIVITY_TYPES.some(type => type === recordActivityType(run))) return false;
    const date = parseActivityDate(run.timestamp);
    if (!date || date.getTime() > now || !activityAmount(run)) return false;
    seen.add(run.id);
    dates.add(pragueDay.format(date));
    return true;
  });
  const awardsByType = Object.fromEntries(ACTIVITY_TYPES.map(type => [type, activityAwards(validRuns, type, now)]));
  const awards = Object.values(awardsByType).flat();
  let badges = 0, achievements = 0, achievementPoints = 0;
  for (const award of awards) {
    if (award.repeatable) badges += award.count;
    else {
      achievements += award.count;
      achievementPoints += award.count * (ACHIEVEMENT_POINTS[award.id] ?? 0);
    }
  }
  const dailyPoints = dates.size * DAILY_ACTIVITY_POINTS;
  const badgePoints = badges * BADGE_POINTS;
  const total = dailyPoints + badgePoints + achievementPoints;
  // Level n starts at 10 × n × (n − 1) points.
  const level = Math.floor((1 + Math.sqrt(1 + total * 0.4)) / 2);
  const levelStart = 10 * level * (level - 1);
  const nextLevelAt = 10 * level * (level + 1);
  const rank = ranks.find(item => level >= item.min) ?? ranks[ranks.length - 1];
  return { activeDays: dates.size, dailyPoints, badges, badgePoints, achievements, achievementPoints, total,
    level, levelStart, nextLevelAt, rank, awardsByType };
}

export type ActivityPoints = ReturnType<typeof activityPoints>;
