"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./services/users";

const CACHE_KEY = "dolni-lhota-theme-v1";
type ThemeCache = { theme: string; customColor: string; animationsEnabled: boolean; gradientEnabled: boolean; savedAt: number };
const defaults: ThemeCache = { theme: "default", customColor: "#36D1DC", animationsEnabled: true, gradientEnabled: true, savedAt: 0 };

function readThemeCache(): ThemeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return defaults;
    const value = JSON.parse(raw);
    return {
      theme: typeof value.theme === "string" ? value.theme : defaults.theme,
      customColor: typeof value.customColor === "string" ? value.customColor : defaults.customColor,
      animationsEnabled: value.animationsEnabled !== false,
      gradientEnabled: value.gradientEnabled !== false,
      savedAt: typeof value.savedAt === "number" ? value.savedAt : 0
    };
  } catch { return defaults; }
}
function writeThemeCache(value: ThemeCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
}

export default function useThemeLoader() {
  useEffect(() => {
    let active = true;
    let userData = readThemeCache();
    // Lokální kopie se aplikuje hned; Firestore ji později případně aktualizuje.
    void applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false, userData.gradientEnabled);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const data = await getUserProfile(user.uid);
        if (!active || !data) return;
        userData = {
          theme: data.theme || "default",
          customColor: data.customColor || "#36D1DC",
          animationsEnabled: data.animationsEnabled !== false,
          gradientEnabled: data.gradientEnabled !== false,
          savedAt: data.themeUpdatedAt instanceof Date ? data.themeUpdatedAt.getTime() : data.themeUpdatedAt && "toDate" in data.themeUpdatedAt && typeof data.themeUpdatedAt.toDate === "function" ? data.themeUpdatedAt.toDate().getTime() : data.themeUpdatedAt && "seconds" in data.themeUpdatedAt && typeof data.themeUpdatedAt.seconds === "number" ? data.themeUpdatedAt.seconds * 1000 : Number(data.themeUpdatedAt || 0)
        };
        const cached = readThemeCache();
        const remoteIsNewer = userData.savedAt > cached.savedAt;
        if (remoteIsNewer || cached.savedAt === 0) {
          writeThemeCache(userData);
          await applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false, userData.gradientEnabled);
        } else {
          userData = cached;
          await applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false, userData.gradientEnabled);
        }
      } catch (error) { console.error("Nepodařilo se načíst vzhled", error); }
    });
    const interval = window.setInterval(() => {
      if (userData.theme === "auto" || userData.theme === "weather") {
        void applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, true, userData.gradientEnabled);
      }
    }, 5 * 60 * 1000);
    return () => { active = false; unsub(); window.clearInterval(interval); };
  }, []);
}

export async function applyTheme(selectedTheme: string, color: string, animationsEnabled = true, persist = true, gradientEnabled = true) {
  let gradient = "linear-gradient(180deg, #36D1DC, #5B86E5)";
  const root = document.documentElement;
  root.removeAttribute("data-weather");
  root.removeAttribute("data-windy");
  root.setAttribute("data-animations", animationsEnabled ? "true" : "false");

  root.removeAttribute("data-theme");
  if (selectedTheme === "dark") {
    gradient = "#000000";
    root.setAttribute("data-theme", "dark");
  } else if (selectedTheme === "light") {
    gradient = "#eef6fb";
    root.setAttribute("data-theme", "light");
  } else if (selectedTheme === "white") {
    gradient = "#ffffff";
    root.setAttribute("data-theme", "white");
  } else if (selectedTheme === "man") gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
  else if (selectedTheme === "woman") gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
  else if (selectedTheme === "auto") {
    const timeTheme = getTimeTheme(new Date());
    gradient = timeTheme.gradient;
    root.setAttribute("data-auto-period", timeTheme.period);
  } else if (selectedTheme === "custom") gradient = `linear-gradient(180deg, ${color}, #000000)`;


  // Zapiš základní nastavení před síťovým požadavkem, aby další start neproblikl.
  if (persist) writeThemeCache({ theme: selectedTheme, customColor: color, animationsEnabled, gradientEnabled, savedAt: Date.now() });
  if (!gradientEnabled) {
    const solid = selectedTheme === "dark" ? "#000000" : selectedTheme === "light" ? "#eef6fb" : selectedTheme === "white" ? "#ffffff" : selectedTheme === "woman" ? "#ff7eb3" : selectedTheme === "man" ? "#2980b9" : selectedTheme === "custom" ? color : "#36D1DC";
    gradient = solid;
  }
  root.style.setProperty("--main-gradient", gradient);

  if (animationsEnabled || selectedTheme === "weather") {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      let response: Response;
      try {
        response = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
      } finally {
        window.clearTimeout(timeout);
      }
      if (!response.ok) throw new Error("Počasí není dostupné");
      const data = await response.json();
      const current = data.current;
      if (!current) throw new Error("Chybí aktuální počasí");
      const condition = String(current.weatherCondition?.type || "").toUpperCase();
      const wind = Number(current.wind?.speed?.value || 0);
      const temperature = Number(current.temperature?.degrees ?? 10);
      const hour = new Date().getHours();
      const night = hour < 6 || hour >= 20;
      const isSnow = condition.includes("SNOW") || condition.includes("SLEET") || condition.includes("HAIL");
      const isRain = condition.includes("RAIN") || condition.includes("DRIZZLE") || condition.includes("THUNDER");
      const isWindy = wind >= 8;
      if (selectedTheme === "weather") {
        if (condition.includes("THUNDER")) gradient = night
          ? "linear-gradient(180deg,#17152d,#34204d)"
          : "linear-gradient(180deg,#53647f,#2f3b59)";
        else if (isRain) gradient = night
          ? "linear-gradient(180deg,#1b2a38,#101820)"
          : "linear-gradient(180deg,#6688a3,#304f68)";
        else if (isSnow) gradient = night
          ? "linear-gradient(180deg,#1d2b3a,#101923)"
          : "linear-gradient(180deg,#b9d4e6,#587d96)";
        else if (condition.includes("FOG")) gradient = "linear-gradient(180deg,#74818a,#414b52)";
        else if (condition.includes("CLOUD")) gradient = night
          ? "linear-gradient(180deg,#202d3a,#17212a)"
          : "linear-gradient(180deg,#8fa9bc,#496c83)";
        else gradient = night
          ? "linear-gradient(180deg,#17253a,#293e61)"
          : "linear-gradient(180deg,#f2b95f,#438bc0)";
        root.style.setProperty("--main-gradient", gradient);
      }
      root.style.setProperty("--wind-strength", String(Math.min(1, Math.max(0.15, wind / 45))));
      if (animationsEnabled && isWindy) root.setAttribute("data-windy", "true");

      let weather = "clear";
      if (isSnow) weather = isWindy ? "snow-wind" : "snow";
      else if (isRain) weather = isWindy ? "rain-wind" : "rain";
      else if (condition.includes("FOG")) weather = "fog";
      else if (isWindy) weather = "wind";
      else if (condition.includes("CLOUD")) weather = "cloudy";
      else if (night) weather = "night";
      root.setAttribute("data-weather", weather);
      if (!gradientEnabled && selectedTheme === "weather") {
        const firstStop = gradient.split(",")[1]?.replace(")", "").trim();
        if (firstStop) gradient = firstStop;
      }
      try {
        const testMode = localStorage.getItem("dolni-lhota-weather-test-v1");
        if (testMode) {
          root.setAttribute("data-weather", testMode);
          root.setAttribute("data-windy", testMode === "wind" ? "true" : "false");
        }
      } catch {}

    } catch (error) {
      console.warn("Vzhled podle počasí se nepodařilo aktualizovat.", error);
    }
  }
  root.style.setProperty("--main-gradient", gradient);
}

function getTimeTheme(date: Date): { period: string; gradient: string } {
  const hour = date.getHours();
  if (hour < 5) return { period: "noc", gradient: "linear-gradient(180deg,#111827,#24163d)" };
  if (hour < 7) return { period: "svitani", gradient: "linear-gradient(180deg,#433b72,#e69a6b)" };
  if (hour < 10) return { period: "rano", gradient: "linear-gradient(180deg,#4d8fc4,#6fc2d8)" };
  if (hour < 13) return { period: "dopoledne", gradient: "linear-gradient(180deg,#3c98cf,#4f78b8)" };
  if (hour < 16) return { period: "odpoledne", gradient: "linear-gradient(180deg,#2e8fc0,#536fb0)" };
  if (hour < 19) return { period: "zapad", gradient: "linear-gradient(180deg,#d77d68,#5869a5)" };
  if (hour < 22) return { period: "soumrak", gradient: "linear-gradient(180deg,#30486d,#2a3155)" };
  return { period: "noc", gradient: "linear-gradient(180deg,#111827,#24163d)" };
}
