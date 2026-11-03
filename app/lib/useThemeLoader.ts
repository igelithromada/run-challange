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
  const root = document.documentElement;
  root.removeAttribute("data-weather");
  if (selectedTheme === "man") gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
  else if (selectedTheme === "woman") gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
  else if (selectedTheme === "auto") {
    gradient = `linear-gradient(180deg, ${getColorByHour(new Date().getHours())}, #000000)`;
  } else if (selectedTheme === "custom") gradient = `linear-gradient(180deg, ${color}, #000000)`;
  else if (selectedTheme === "weather") {
    try {
      const response = await fetch("/api/weather", { cache: "no-store" });
      if (!response.ok) throw new Error("Počasí není dostupné");
      const data = await response.json();
      const current = data.current;
      if (!current) throw new Error("Chybí aktuální počasí");
      const condition = String(current.weatherCondition?.type || "").toUpperCase();
      const wind = Number(current.wind?.speed?.value || 0);
      const temperature = Number(current.temperature?.degrees ?? 10);
      const hour = new Date().getHours();
      const night = hour < 6 || hour >= 20;
      let weather = "clear";
      const isSnow = condition.includes("SNOW") || condition.includes("SLEET") || condition.includes("HAIL");
      const isRain = condition.includes("RAIN") || condition.includes("DRIZZLE") || condition.includes("THUNDER");
      const isWindy = wind >= 8;
      if (isSnow) weather = isWindy ? "snow-wind" : "snow";
      else if (isRain) weather = isWindy ? "rain-wind" : "rain";
      else if (condition.includes("FOG")) weather = "fog";
      else if (isWindy) weather = "wind";
      else if (condition.includes("CLOUD")) weather = "cloudy";
      else if (night) weather = "night";
      root.setAttribute("data-weather", weather);
      if (weather === "rain" || weather === "rain-wind") gradient = "linear-gradient(160deg, #263849 0%, #526b82 52%, #172633 100%)";
      else if (weather === "snow" || weather === "snow-wind") gradient = "linear-gradient(160deg, #607d91 0%, #a9c4d5 52%, #344b60 100%)";
      else if (weather === "fog" || weather === "cloudy") gradient = "linear-gradient(160deg, #71818d 0%, #aeb9c0 52%, #465763 100%)";
      else if (weather === "wind") gradient = "linear-gradient(160deg, #537b91 0%, #9ab6c1 52%, #304c60 100%)";
      else if (weather === "night") gradient = "linear-gradient(160deg, #101b3a 0%, #283d67 55%, #111827 100%)";
      else gradient = temperature >= 25
        ? "linear-gradient(160deg, #e7a34b 0%, #e98b68 52%, #397ca8 100%)"
        : "linear-gradient(160deg, #f5b94c 0%, #6bc6dc 52%, #397ca8 100%)";
    } catch (error) {
      console.warn("Vzhled podle počasí se nepodařilo aktualizovat.", error);
      gradient = `linear-gradient(180deg, ${getColorByHour(new Date().getHours())}, #000000)`;
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
