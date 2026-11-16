/** Accept ISO dates and Firestore's JSON timestamp representation. */
export function parseActivityDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "string") date = new Date(value);
  else if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    const nanos = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    date = new Date(value.seconds * 1000 + nanos / 1e6);
  } else return null;
  return Number.isFinite(date.getTime()) ? date : null;
}
