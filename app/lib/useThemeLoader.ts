"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function useThemeLoader() {
  useEffect(() => {
    let userData = { theme: "default", customColor: "#36D1DC" };
    let active = true;
    const applyCurrentTheme = () => { if (active) void applyTheme(userData.theme, userData.customColor); };
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!active || !userDoc.exists()) return;
        const data = userDoc.data();
        userData = { theme: data.theme || "default", customColor: data.customColor || "#36D1DC" };
        applyCurrentTheme();
      } catch (error) { console.error("Nepodařilo se načíst vzhled", error); }
    });
    const interval = setInterval(applyCurrentTheme, 300000);
    return () => { active = false; unsub(); clearInterval(interval); };
  }, []);
}

export async function applyTheme(selectedTheme: string, color: string) {
  let gradient = "linear-gradient(180deg, #36D1DC, #5B86E5)";
  if (selectedTheme === "man") gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
  else if (selectedTheme === "woman") gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
  else if (selectedTheme === "auto") {
    const hour = new Date().getHours();
    gradient = `linear-gradient(180deg, ${getColorByHour(hour)}, #000000)`;
  } else if (selectedTheme === "custom") gradient = `linear-gradient(180deg, ${color}, #000000)`;
  else if (selectedTheme === "weather") {
    try {
      // Open-Meteo poskytuje aktuální počasí zdarma, bez API klíče.
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=49.84&longitude=18.10&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FPrague");
      if (!response.ok) throw new Error("Počasí není dostupné");
      const data = await response.json();
      const current = data.current || {};
      const code = Number(current.weather_code);
      const rain = Number(current.precipitation) > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
      const cloudy = [1, 2, 3, 45, 48].includes(code);
      const windy = Number(current.wind_speed_10m) >= 30;
      const night = (() => { const h = new Date().getHours(); return h < 6 || h >= 20; })();
      if (rain) gradient = "linear-gradient(160deg, #263849 0%, #526b82 52%, #172633 100%)";
      else if (windy) gradient = "linear-gradient(160deg, #537b91 0%, #9ab6c1 52%, #304c60 100%)";
      else if (cloudy) gradient = "linear-gradient(160deg, #71818d 0%, #aeb9c0 52%, #465763 100%)";
      else if (night) gradient = "linear-gradient(160deg, #101b3a 0%, #283d67 55%, #111827 100%)";
      else gradient = "linear-gradient(160deg, #f5b94c 0%, #6bc6dc 52%, #397ca8 100%)";
      document.documentElement.style.setProperty("--weather-description", JSON.stringify({
        temperature: current.temperature_2m, wind: current.wind_speed_10m, code
      }));
    } catch (error) {
      console.warn("Aktuální počasí se nepodařilo načíst, používám denní vzhled.", error);
      const hour = new Date().getHours();
      gradient = `linear-gradient(180deg, ${getColorByHour(hour)}, #000000)`;
    }
  }
  document.documentElement.style.setProperty("--main-gradient", gradient);
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
