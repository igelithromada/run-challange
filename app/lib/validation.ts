import type { ActivityType, ChallengeKind } from "../types";

export function isActivityType(value: unknown): value is ActivityType { return value === "běh" || value === "chůze"; }
export function normalizeActivityType(value: unknown): ActivityType { return value === "chůze" ? "chůze" : "běh"; }

export function normalizeName(value: unknown, max = 40): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function normalizeTeamName(value: unknown): string { return normalizeName(value, 40); }
export function normalizeDescription(value: unknown): string { return typeof value === "string" ? value.trim().slice(0, 200) : ""; }
export function isChallengeKind(value: unknown): value is ChallengeKind {
  return value === "distance" || value === "activities" || value === "activeDays" || value === "sharedDistance";
}
export function isValidChallengeGoal(kind: ChallengeKind, value: unknown): boolean {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return false;
  return kind === "distance" || kind === "sharedDistance" ? n <= 100000 : Number.isInteger(n) && n <= 100000;
}
export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function isValidRegistrationCode(value: unknown): value is string { return typeof value === "string" && value.trim().length >= 4 && value.trim().length <= 128; }

export function isValidPushSubscription(value: unknown): value is { endpoint:string; keys:{p256dh:string;auth:string} } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>, keys = candidate.keys;
  try {
    const endpoint = new URL(String(candidate.endpoint || ""));
    const hosts = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
    if(endpoint.protocol!=="https:" || endpoint.username || endpoint.password || (endpoint.port && endpoint.port!=="443") || !hosts.some(host=>endpoint.hostname===host||endpoint.hostname.endsWith("."+host)))return false;
  } catch { return false; }
  return typeof candidate.endpoint === "string" && candidate.endpoint.length <= 4096 &&
    !!keys && typeof keys === "object" &&
    typeof (keys as Record<string, unknown>).p256dh === "string" &&
    typeof (keys as Record<string, unknown>).auth === "string";
}
