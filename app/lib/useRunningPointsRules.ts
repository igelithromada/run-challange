"use client";

import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { parseRunningPointsConfig, type RunningPointsConfig } from "./runningPointsConfig";

type State = { rules: RunningPointsConfig | null; error: boolean };
const initial: State = { rules: null, error: false };
const listeners = new Set<() => void>();
let snapshot = initial;
let pending = false;
let lastRequest = 0;
let generation = 0;
let account = "";
let disconnect: (() => void) | undefined;

function publish(next: State) {
  if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function applyRunningPointsRules(rules: RunningPointsConfig) {
  generation++;
  lastRequest = Date.now();
  publish({ rules, error: false });
}

export async function refreshRunningPointsRules(force = false) {
  const user = auth.currentUser;
  if (!user || user.uid !== account || pending || document.hidden || (!force && Date.now() - lastRequest < 15_000)) return;
  pending = true;
  lastRequest = Date.now();
  const requestGeneration = generation;
  try {
    const response = await fetch("/api/running-points", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    const data = response.ok ? await response.json() : null;
    const rules = parseRunningPointsConfig(data?.rules);
    if (!rules) throw new Error("Pravidla bodování nejsou dostupná.");
    if (requestGeneration === generation) publish({ rules, error: false });
  } catch {
    if (requestGeneration === generation) publish({ ...snapshot, error: true });
  } finally {
    pending = false;
    if (account && user.uid !== account) void refreshRunningPointsRules();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!disconnect) {
    const unsubscribe = onAuthStateChanged(auth, user => {
      const uid = user?.uid || "";
      if (account !== uid) {
        account = uid;
        generation++;
        lastRequest = 0;
        publish(initial);
      }
      void refreshRunningPointsRules();
    });
    const refresh = () => void refreshRunningPointsRules();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    disconnect = () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    disconnect?.();
    disconnect = undefined;
  };
}

export function useRunningPointsRules() {
  return useSyncExternalStore(subscribe, () => snapshot, () => initial);
}
