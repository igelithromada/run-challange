"use client";

const STORAGE_KEY = "dolni-lhota-haptics-v1";

export type HapticType = "light";

export function isHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false"); } catch {}
}

export function triggerHaptic(type: HapticType = "light") {
  if (!isHapticsEnabled()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(type === "light" ? 10 : 10);
  } catch {}
}
