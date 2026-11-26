import { recordActivityType } from "./activity";
import { parseActivityDate } from "./runData";

export const RUN_POINTS = {
  minimumKm: 1,
  perKm: 5,
  distanceBonusCapKm: 20,
  distanceDivisor: 60,
  fullDayBonusKm: 5,
  weeklyBonuses: [5, 5, 5, 10, 15, 20, 25],
  inactivityDays: 30,
  inactivityPercent: 10,
  levelFactor: 50,
} as const;

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

const DAY_MS = 86_400_000;
const pragueDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

export function scoringDay(date: Date) {
  const parts = pragueDate.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

export type PointRun = { id: string; km?: number | string; timestamp?: unknown; type?: string; activityType?: string; deleting?: boolean };
export type RecordPoints = { distancePoints: number; consistencyPoints: number };

export function runningDistancePoints(km: number) {
  if (!Number.isFinite(km) || km < RUN_POINTS.minimumKm) return 0;
  return Math.round(RUN_POINTS.perKm * km * (1 + Math.min(km, RUN_POINTS.distanceBonusCapKm) / RUN_POINTS.distanceDivisor));
}

export function runningDayBonus(km: number, dayNumber: number) {
  const base = RUN_POINTS.weeklyBonuses[dayNumber - 1] ?? 0;
  if (!base || km < RUN_POINTS.minimumKm) return 0;
  return Math.max(1, Math.round(base * Math.min(1, (km / RUN_POINTS.fullDayBonusKm) ** 2)));
}

export function levelThreshold(level: number) {
  return RUN_POINTS.levelFactor * level * (level - 1);
}

export function activityPoints(runs: readonly PointRun[], now = Date.now()) {
  const seen = new Set<string>();
  const eligible = runs.flatMap(run => {
    if (run.deleting || seen.has(run.id) || recordActivityType(run) !== "běh") return [];
    const km = Number(run.km);
    const distancePoints = runningDistancePoints(km);
    const date = parseActivityDate(run.timestamp);
    if (!distancePoints || !date || date.getTime() > now) return [];
    seen.add(run.id);
    return [{ id: run.id, time: date.getTime(), day: scoringDay(date), km, distancePoints }];
  }).sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const records = new Map<string, RecordPoints>();
  let lastDay: number | undefined;
  let week: number | undefined;
  let weeklyDays = 0, dayKm = 0, dayBonus = 0;
  let distancePoints = 0, consistencyPoints = 0, balance = 0;

  function applyInactivity(untilDay: number) {
    if (lastDay === undefined) return;
    const periods = Math.floor((untilDay - lastDay) / RUN_POINTS.inactivityDays);
    balance *= (1 - RUN_POINTS.inactivityPercent / 100) ** periods;
  }

  for (const run of eligible) {
    if (run.day !== lastDay) {
      applyInactivity(run.day);
      // Day zero was a Thursday. Each scoring week starts on Monday.
      const runWeek = Math.floor((run.day + 3) / 7);
      weeklyDays = runWeek === week ? weeklyDays + 1 : 1;
      week = runWeek;
      lastDay = run.day;
      dayKm = 0;
      dayBonus = 0;
    }
    dayKm += run.km;
    const bonus = runningDayBonus(dayKm, weeklyDays);
    const addedBonus = bonus - dayBonus;
    dayBonus = bonus;
    distancePoints += run.distancePoints;
    consistencyPoints += addedBonus;
    balance += run.distancePoints + addedBonus;
    records.set(run.id, { distancePoints: run.distancePoints, consistencyPoints: addedBonus });
  }

  applyInactivity(scoringDay(new Date(now)));
  const total = Math.round(balance);
  const deducted = distancePoints + consistencyPoints - total;
  const level = Math.floor((1 + Math.sqrt(1 + 4 * total / RUN_POINTS.levelFactor)) / 2);
  const rank = ranks.find(item => level >= item.min) ?? ranks[ranks.length - 1];
  return { distancePoints, consistencyPoints, deducted, total, level, levelStart: levelThreshold(level),
    nextLevelAt: levelThreshold(level + 1), rank, records };
}

export type ActivityPoints = ReturnType<typeof activityPoints>;
