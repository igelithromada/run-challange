import { activityAmount, isStrengthActivity, recordActivityType } from "./activity";
import { parseActivityDate } from "./runData";
import type { ActivityType } from "../types";
export type AwardRun = { id: string; repetitions?:number; km: number | string; timestamp?: unknown; type?: string; activityType?: string; deleting?: boolean };
export type Award = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  count: number;
  repeatable: boolean;
};
const czechTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
export function activityAwards(
  runs: AwardRun[],
  type: ActivityType = "běh",
  now = Date.now(),
): Award[] {
  const seen = new Set<string>(),
    days = new Set<number>(),
    months = new Map<string, number>();
  let km = 0,
    activities = 0,
    morning = 0,
    night = 0;
  for (const run of runs) {
    if (run.deleting || recordActivityType(run) !== type) continue;
    if (seen.has(run.id)) continue;
    const date = parseActivityDate(run.timestamp),
      distance = activityAmount(run);
    if (
      !date ||
      date.getTime() > now ||
      !Number.isFinite(distance) ||
      distance <= 0
    )
      continue;
    seen.add(run.id);
    const parts = Object.fromEntries(
        czechTime.formatToParts(date).map((p) => [p.type, p.value]),
      ),
      hour = Number(parts.hour),
      month = parts.year + "-" + parts.month;
    activities++;
    km += distance;
    months.set(month, (months.get(month) || 0) + distance);
    days.add(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) /
        86400000,
    );
    if (hour >= 5 && hour < 8) morning++;
    if (hour >= 21 || hour < 5) night++;
  }
  let longestStreak = 0,
    current = 0,
    previous = -Infinity;
  for (const day of [...days].sort((a, b) => a - b)) {
    current = day === previous + 1 ? current + 1 : 1;
    longestStreak = Math.max(longestStreak, current);
    previous = day;
  }
  const reachedAmount = (amount: number, target: number) => Math.round(amount * 1e8) >= target * 1e8;
  const bestMonth = Math.max(0, ...months.values());
  const one = (
    id: string,
    title: string,
    detail: string,
    icon: string,
    done: boolean,
  ): Award => ({
    id,
    title,
    detail,
    icon,
    count: done ? 1 : 0,
    repeatable: false,
  });
  const strength = isStrengthActivity(type);
  return [
    one(
      "first",
      strength ? "První trénink" : "První krok",
      "Zaznamenaná první aktivita",
      strength ? "💪" : "👟",
      activities >= 1,
    ),
    ...(strength ? [
      one("reps100", "První stovka", "Celkem 100 opakování", "🥉", reachedAmount(km, 100)),
      one("reps500", "Pět set", "Celkem 500 opakování", "🥈", reachedAmount(km, 500)),
      one("reps1000", "Tisícovka", "Celkem 1 000 opakování", "🥇", reachedAmount(km, 1000)),
      one("reps5000", "Pět tisíc", "Celkem 5 000 opakování", "🏆", reachedAmount(km, 5000)),
      one("month1000", "Silný měsíc", "1 000 opakování v jednom měsíci", "💪", reachedAmount(bestMonth, 1000)),
    ] : [
    one("km10", "Desítka", "Celkem 10 km", "🔟", reachedAmount(km, 10)),
    one("km50", "Padesátka", "Celkem 50 km", "🥉", reachedAmount(km, 50)),
    one("km100", "Stovka", "Celkem 100 km", "🥈", reachedAmount(km, 100)),
    one("km250", "Čtvrt tisíce", "Celkem 250 km", "🥇", reachedAmount(km, 250)),
    one(
      "month100",
      "Stokilometrový měsíc",
      "100 km v jednom kalendářním měsíci",
      "🌙",
      reachedAmount(bestMonth, 100),
    ),
    ]),
    one(
      "streak7",
      "Pravidelnost",
      "Aktivita alespoň 7 dní za sebou",
      "🔥",
      longestStreak >= 7,
    ),
    one(
      "activities10",
      "Deset aktivit",
      "Zaznamenáno 10 aktivit",
      "📅",
      activities >= 10,
    ),
    one(
      "activities50",
      "Padesát aktivit",
      "Zaznamenáno 50 aktivit",
      "💪",
      activities >= 50,
    ),
    {
      id: "morning",
      title: "Ranní ptáče",
      detail: "Každá aktivita od 5:00 do 7:59 · český čas",
      icon: "🐦",
      count: morning,
      repeatable: true,
    },
    {
      id: "night",
      title: strength ? "Noční trénink" : type === "běh" ? "Noční běh" : "Noční chůze",
      detail: "Každá aktivita od 21:00 do 4:59 · český čas",
      icon: "🌙",
      count: night,
      repeatable: true,
    },
  ];
}
export const awardTotal = (awards: Award[]) =>
  awards.reduce((sum, a) => sum + a.count, 0);
