import type { ActivityType } from "../types";

export function isActivityType(value: unknown): value is ActivityType {
  return value === "běh" || value === "chůze";
}

export function normalizeActivityType(value: unknown): ActivityType {
  return value === "chůze" ? "chůze" : "běh";
}

export function normalizeTeamName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 60) : "";
}

export function isValidRegistrationCode(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 4 && value.trim().length <= 128;
}

export function isValidPushSubscription(value: unknown): value is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const keys = candidate.keys;
  return (
    typeof candidate.endpoint === "string" &&
    candidate.endpoint.length <= 4096 &&
    !!keys &&
    typeof keys === "object" &&
    typeof (keys as Record<string, unknown>).p256dh === "string" &&
    typeof (keys as Record<string, unknown>).auth === "string"
  );
}
