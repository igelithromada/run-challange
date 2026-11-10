"use client";

const STORAGE_KEY = "dolni-lhota-haptics-v1";
let enabledState = true;

export type HapticType = "light";

export function isHapticsEnabled(): boolean {
  return enabledState;
}

export function setHapticsEnabled(enabled: boolean) {
  enabledState = enabled;
  try { localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false"); } catch {}
}

export function triggerHaptic(type: HapticType = "light") {
  if (!enabledState) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(type === "light" ? 5 : 5); } catch {}
}
