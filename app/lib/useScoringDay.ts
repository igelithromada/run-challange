"use client";

import { useSyncExternalStore } from "react";
import { scoringDay } from "./activityPoints";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const currentDay = () => scoringDay(new Date());
const serverDay = () => 0;

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(notify, 60_000);
    window.addEventListener("focus", notify);
    document.addEventListener("visibilitychange", notify);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearInterval(timer);
    timer = undefined;
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

export function useScoringDay() {
  return useSyncExternalStore(subscribe, currentDay, serverDay);
}
