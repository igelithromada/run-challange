"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./services/users";
import type { UserData } from "../types";
import { DEFAULT_APPEARANCE, THEME_CACHE_KEY, normalizeAppearance, timePeriod, weatherPalette, type Appearance } from "./appearance";

type CachedAppearance = Appearance & { savedAt: number; uid?: string };
let currentAppearance = DEFAULT_APPEARANCE;
let weatherRequest: AbortController | undefined;

export function readAppearanceCache(): CachedAppearance {
  try {
    const cached = JSON.parse(localStorage.getItem(THEME_CACHE_KEY) || "null");
    return {
      ...normalizeAppearance(cached),
      savedAt: typeof cached?.savedAt === "number" ? cached.savedAt : 0,
      uid: typeof cached?.uid === "string" ? cached.uid : undefined,
    };
  } catch {
    return { ...DEFAULT_APPEARANCE, savedAt: 0 };
  }
}

function writeAppearanceCache(appearance: CachedAppearance) {
  try { localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(appearance)); } catch {}
}

export function resolveAppearance(profile: UserData, uid: string): CachedAppearance {
  const local = readAppearanceCache();
  const date = profile.themeUpdatedAt;
  const savedAt = date instanceof Date ? date.getTime()
    : date && "seconds" in date ? date.seconds * 1000 + (date.nanoseconds ?? 0) / 1_000_000
    : Number(date || 0);
  if (local.uid === uid && local.savedAt > savedAt) return local;
  return { ...normalizeAppearance(profile), uid, savedAt };
}

export default function useThemeLoader() {
  useEffect(() => {
    let active = true;
    const initial = readAppearanceCache();
    applyAppearance(initial);
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) return;
      const cached = readAppearanceCache();
      if (cached.uid && cached.uid !== user.uid) applyAppearance(DEFAULT_APPEARANCE);
      try {
        const profile = await getUserProfile(user.uid);
        if (!active || auth.currentUser?.uid !== user.uid || !profile) return;
        const appearance = resolveAppearance(profile, user.uid);
        writeAppearanceCache(appearance);
        applyAppearance(appearance);
      } catch (error) {
        console.error("Nepodařilo se načíst vzhled", error);
      }
    });

    function refresh() {
      if (document.visibilityState !== "visible") return;
      if (currentAppearance.theme === "auto" || currentAppearance.theme === "weather") {
        applyAppearance(currentAppearance, false);
      }
    }
    // Time-dependent palettes change on an hour boundary. Weather needs fewer refreshes.
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      weatherRequest?.abort();
      weatherRequest = undefined;
    };
  }, []);
}

let lastWeatherCheck = 0;

export function applyAppearance(appearance: Appearance, refreshWeather = true) {
  currentAppearance = appearance;
  const { theme, customColor, gradientEnabled } = appearance;
  const root = document.documentElement;
  const switchedMode = root.dataset.theme !== theme;
  root.dataset.theme = theme === "light" ? "white" : theme;
  root.toggleAttribute("data-solid-theme", !gradientEnabled);
  if (theme === "auto") root.dataset.autoPeriod = timePeriod(new Date().getHours());
  else delete root.dataset.autoPeriod;
  if (theme === "custom") root.style.setProperty("--custom-theme-color", customColor);
  else root.style.removeProperty("--custom-theme-color");

  if (theme !== "weather") {
    weatherRequest?.abort();
    weatherRequest = undefined;
    lastWeatherCheck = 0;
    delete root.dataset.weather;
    return;
  }

  if (weatherRequest || (!switchedMode && !refreshWeather && Date.now() - lastWeatherCheck < 5 * 60_000)) return;
  const controller = new AbortController();
  weatherRequest = controller;
  lastWeatherCheck = Date.now();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  void (async () => {
    try {
      const response = await fetch("/api/weather", { signal: controller.signal });
      if (!response.ok) return;
      const { current } = await response.json();
      if (!current || controller.signal.aborted || currentAppearance.theme !== "weather") return;
      const palette = weatherPalette(current, new Date().getHours());
      if (palette) root.dataset.weather = palette;
    } catch {
      // Keep the current palette through temporary network failures.
    } finally {
      window.clearTimeout(timeout);
      if (weatherRequest === controller) weatherRequest = undefined;
    }
  })();
}

export function saveAppliedAppearance(appearance: Appearance, uid: string, savedAt: number) {
  writeAppearanceCache({ ...appearance, uid, savedAt });
  applyAppearance(appearance);
}
