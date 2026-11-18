"use client";

const STORAGE_KEY = "dolni-lhota-haptics-v1";
let enabledState = true;

export function setHapticsEnabled(enabled: boolean) {
  enabledState = enabled;
  try { localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false"); } catch {}
}

export function triggerHaptic() {
  if (!enabledState) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(5); } catch {}
}
