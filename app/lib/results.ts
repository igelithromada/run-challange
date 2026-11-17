import { activityMetrics, type ActivityMetric } from "./activityMetrics";
import { parseActivityDate } from "./runData";
import type { ActivityType, PublicProfileData, RunData } from "../types";
export const RESULT_ALPHABET = [
  "A",
  "B",
  "C",
  "Č",
  "D",
  "E",
  "F",
  "G",
  "H",
  "CH",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "Ř",
  "S",
  "Š",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "Ž",
  "#",
];
export type ResultPerson = ActivityMetric & {
  uid: string;
  name: string;
  avatarUrl: string;
  rank: number;
};
export const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")
    .trim();
export function resultLetter(name: string) {
  const value = name.trim().normalize("NFC").toLocaleUpperCase("cs");
  if (value.startsWith("CH")) return "CH";
  const first = value.charAt(0);
  const letter = ["Č", "Ř", "Š", "Ž"].includes(first)
    ? first
    : normalizeName(first).toUpperCase();
  return RESULT_ALPHABET.includes(letter) ? letter : "#";
}
export function resultRuns(
  runs: RunData[],
  type: ActivityType,
  from: string,
  to: string,
) {
  const start = from ? Date.parse(from + "T00:00:00") : -Infinity,
    end = to ? Date.parse(to + "T23:59:59.999") : Infinity;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  return runs.filter((run) => {
    if (!run.uid || (run.type || "běh") !== type) return false;
    const date = parseActivityDate(run.timestamp);
    return date !== null && date.getTime() >= start && date.getTime() <= end;
  });
}
export function resultPeople(
  runs: RunData[],
  profiles: Record<string, PublicProfileData>,
  metric: "km" | "tempo",
): ResultPerson[] {
  const groups = new Map<string, RunData[]>();
  for (const run of runs) {
    const group = groups.get(run.uid) || [];
    group.push(run);
    groups.set(run.uid, group);
  }
  const people = Array.from(groups, ([uid, items]) => {
    const metrics = activityMetrics(items),
      fallback = items.find((r) => r.nickname?.trim()),
      avatar = items.find((r) => r.avatarUrl);
    return {
      uid,
      ...metrics,
      name:
        profiles[uid]?.nickname?.trim() ||
        fallback?.nickname?.trim() ||
        "Uživatel",
      avatarUrl: profiles[uid]?.avatarUrl || avatar?.avatarUrl || "",
      rank: 0,
    };
  });
  people.sort((a, b) => {
    const difference =
      metric === "tempo"
        ? (a.pace > 0 ? a.pace : Infinity) - (b.pace > 0 ? b.pace : Infinity)
        : b.km - a.km;
    return (
      difference ||
      a.name.localeCompare(b.name, "cs") ||
      a.uid.localeCompare(b.uid)
    );
  });
  return people.map((p, index) => ({ ...p, rank: index + 1 }));
}
export function visiblePeople(
  people: ResultPerson[],
  search: string,
  alpha: boolean,
) {
  const words = normalizeName(search).split(/\s+/).filter(Boolean);
  const filtered = people.filter((p) =>
    words.every((word) => normalizeName(p.name).includes(word)),
  );
  return alpha
    ? [...filtered].sort(
        (a, b) =>
          RESULT_ALPHABET.indexOf(resultLetter(a.name)) -
            RESULT_ALPHABET.indexOf(resultLetter(b.name)) ||
          a.name.localeCompare(b.name, "cs"),
      )
    : filtered;
}
export function formatResultDuration(minutes: number) {
  const seconds = Math.max(0, Math.round(minutes * 60));
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;
}
