"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./services/users";

const CACHE_KEY = "dolni-lhota-theme-v1";
type ThemeCache = { theme: string; customColor: string; animationsEnabled: boolean; savedAt: number };
const defaults: ThemeCache = { theme: "default", customColor: "#36D1DC", animationsEnabled: true, savedAt: 0 };

function readThemeCache(): ThemeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return defaults;
    const value = JSON.parse(raw);
    return {
      theme: typeof value.theme === "string" ? value.theme : defaults.theme,
      customColor: typeof value.customColor === "string" ? value.customColor : defaults.customColor,
      animationsEnabled: value.animationsEnabled !== false,
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
    void applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const data = await getUserProfile(user.uid);
        if (!active || !data) return;
        userData = {
          theme: data.theme || "default",
          customColor: data.customColor || "#36D1DC",
          animationsEnabled: data.animationsEnabled !== false,
          savedAt: data.themeUpdatedAt instanceof Date ? data.themeUpdatedAt.getTime() : data.themeUpdatedAt && "toDate" in data.themeUpdatedAt && typeof data.themeUpdatedAt.toDate === "function" ? data.themeUpdatedAt.toDate().getTime() : data.themeUpdatedAt && "seconds" in data.themeUpdatedAt && typeof data.themeUpdatedAt.seconds === "number" ? data.themeUpdatedAt.seconds * 1000 : Number(data.themeUpdatedAt || 0)
        };
        const cached = readThemeCache();
        const remoteIsNewer = userData.savedAt > cached.savedAt;
        if (remoteIsNewer || cached.savedAt === 0) {
          writeThemeCache(userData);
          await applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false);
        } else {
          userData = cached;
          await applyTheme(userData.theme, userData.customColor, userData.animationsEnabled, false);
        }
      } catch (error) { console.error("Nepodařilo se načíst vzhled", error); }
    });
    const interval = window.setInterval(() => {
      if (userData.theme === "auto" || userData.theme === "weather") {
        void applyTheme(userData.theme, userData.customColor, userData.animationsEnabled);
      }
    }, 30 * 60 * 1000);
    return () => { active = false; unsub(); window.clearInterval(interval); };
  }, []);
}

export async function applyTheme(selectedTheme: string, color: string, animationsEnabled = true, persist = true) {
  let gradient = "linear-gradient(180deg, #36D1DC, #5B86E5)";
  const root = document.documentElement;
  root.removeAttribute("data-weather");
  root.removeAttribute("data-windy");
  root.setAttribute("data-animations", animationsEnabled ? "true" : "false");

  root.removeAttribute("data-theme");
  if (selectedTheme === "dark") {
    gradient = "#071000";
    root.setAttribute("data-theme", "dark");
  } else if (selectedTheme === "light") {
    gradient = "#eef6fb";
    root.setAttribute("data-theme", "light");
  } else if (selectedTheme === "white") {
    gradient = "#ffffff";
    root.setAttribute("data-theme", "white");
  } else if (selectedTheme === "man") gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
  else if (selectedTheme === "woman") gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
  else if (selectedTheme === "auto") gradient = `linear-gradient(180deg, ${getColorByHour(new Date().getHours())}, #000000)`;
  else if (selectedTheme === "custom") gradient = `linear-gradient(180deg, ${color}, #000000)`;


  // Zapiš základní nastavení před síťovým požadavkem, aby další start neproblikl.
  if (persist) writeThemeCache({ theme: selectedTheme, customColor: color, animationsEnabled, savedAt: Date.now() });
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
        if (isRain) gradient = night ? "linear-gradient(180deg,#243b55,#101820)" : "linear-gradient(180deg,#5f7f99,#243b55)";
        else if (isSnow) gradient = night ? "linear-gradient(180deg,#26384a,#16232f)" : "linear-gradient(180deg,#dbeafe,#6f8fa8)";
        else if (condition.includes("FOG")) gradient = "linear-gradient(180deg,#7f8c8d,#46545c)";
        else if (condition.includes("CLOUD")) gradient = night ? "linear-gradient(180deg,#293949,#1b2630)" : "linear-gradient(180deg,#8fa9bc,#4f7188)";
        else gradient = night ? "linear-gradient(180deg,#15253d,#243b55)" : "linear-gradient(180deg,#ffd166,#4facfe)";
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


    } catch (error) {
      console.warn("Vzhled podle počasí se nepodařilo aktualizovat.", error);
    }
  }
  root.style.setProperty("--main-gradient", gradient);
}

const getColorByHour = (hour: number): string => {
  let lightness = 90;
  if (hour < 6) lightness = 20;
  else if (hour < 10) lightness = 70;
  else if (hour < 16) lightness = 90;
  else if (hour < 20) lightness = 60;
  else lightness = 30;
  return `hsl(200, 70%, ${lightness}%)`;
};
