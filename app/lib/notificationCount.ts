import type { User } from "firebase/auth";

export const NOTIFICATION_REFRESH_MS = 30 * 60 * 1000;
let current: { uid: string; count: number; checkedAt: number } | undefined;
let pending: { uid: string; request: Promise<number> } | undefined;
let generation = 0;

export function cachedNotificationCount(uid: string) {
  return current?.uid === uid ? current : undefined;
}

export function clearNotificationCount() {
  generation++;
  current = undefined;
  pending = undefined;
}

export function expireNotificationCount(uid: string) {
  if (current?.uid === uid) current = { ...current, checkedAt: Number.NEGATIVE_INFINITY };
  if (pending?.uid === uid) {
    generation++;
    pending = undefined;
  }
}

export function rememberNotificationCount(uid: string, count: number) {
  generation++;
  pending = undefined;
  current = { uid, count, checkedAt: Date.now() };
}

export function loadNotificationCount(user: User, force = false) {
  const saved = cachedNotificationCount(user.uid);
  if (!force && saved && Date.now() - saved.checkedAt < NOTIFICATION_REFRESH_MS) {
    return Promise.resolve(saved.count);
  }
  if (pending?.uid === user.uid) return pending.request;
  const version = ++generation;
  const request = (async () => {
    const token = await user.getIdToken();
    const response = await fetch("/api/notifications?view=count", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Upozornění se nepodařilo načíst.");
    const count = Number((await response.json()).unreadCount) || 0;
    if (version === generation) current = { uid: user.uid, count, checkedAt: Date.now() };
    return cachedNotificationCount(user.uid)?.count ?? count;
  })().finally(() => { if (pending?.request === request) pending = undefined; });
  pending = { uid: user.uid, request };
  return request;
}
