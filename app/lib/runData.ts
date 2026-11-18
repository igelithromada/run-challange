export const RECENT_ACTIVITY_LIMIT = 30;

/** Accept ISO dates and Firestore's JSON timestamp representation. */
export function parseActivityDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try { date = value.toDate(); } catch { return null; }
    if (!(date instanceof Date)) return null;
  }
  else if (typeof value === "string") date = new Date(value);
  else if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const nanos = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    date = new Date(value.seconds * 1000 + nanos / 1e6);
  } else return null;
  return Number.isFinite(date.getTime()) ? date : null;
}

/** A fresh snapshot takes precedence over a paged copy of the same activity. */
export function mergeActivityFeed<T extends { id: string; timestamp?: unknown; deleting?: boolean }>(
  older: T[],
  latest: T[],
): T[] {
  const unique = new Map([...older, ...latest].map(run => [run.id, run] as const));
  return [...unique.values()]
    .filter(run => !run.deleting)
    .map(run => ({ run, time: parseActivityDate(run.timestamp)?.getTime() ?? -Infinity }))
    .sort((left, right) => right.time - left.time || right.run.id.localeCompare(left.run.id))
    .map(({ run }) => run);
}
