"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const CACHE_KEY = "dolni-lhota-theme-v1";
type ThemeCache = { theme: string; customColor: string; animationsEnabled: boolean };
const defaults: ThemeCache = { theme: "default", customColor: "#36D1DC", animationsEnabled: true };

function readThemeCache(): ThemeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return defaults;
    const value = JSON.parse(raw);
    return {
      theme: typeof value.theme === "string" ? (value.theme === "weather" ? "default" : value.theme) : defaults.theme,
      customColor: typeof value.customColor === "string" ? value.customColor : defaults.customColor,
      animationsEnabled: value.animationsEnabled !== false
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
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!active || !userDoc.exists()) return;
        const data = userDoc.data();
        userData = {
          theme: data.theme === "weather" ? "default" : (data.theme || "default"),
          customColor: data.customColor || "#36D1DC",
          animationsEnabled: data.animationsEnabled !== false
        };
        writeThemeCache(userData);
        await applyTheme(userData.theme, userData.customColor, userData.animationsEnabled);
      } catch (error) { console.error("Nepodařilo se ...[truncated]