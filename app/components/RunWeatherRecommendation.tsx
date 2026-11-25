"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, CloudSun } from "lucide-react";
import { isStrengthActivity } from "../lib/activity";
import type { ActivityType } from "./ActivityTypeSelector";
import type { WeatherResponse } from "../lib/weather";
import { auth } from "../lib/firebase";
import { getUserProfile } from "../lib/services/users";
import { getActivityWeatherAdvice } from "../lib/weatherRecommendation";
import WeatherVisual, { weatherDescription } from "./WeatherVisual";

export default function RunWeatherRecommendation({ linkToWeather = true, type }: { linkToWeather?: boolean; type?: ActivityType }) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [resolvedType, setResolvedType] = useState<ActivityType>(type || "běh");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (type) return;
    let active = true;
    const resolveType = async () => {
      try {
        const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
        if (active && (cached === "běh" || cached === "chůze")) setResolvedType(cached);
        const user = auth.currentUser;
        if (user) {
          const profile = await getUserProfile(user.uid);
          if (active && auth.currentUser?.uid === user.uid && profile) setResolvedType(profile.defaultActivity === "chůze" ? "chůze" : "běh");
        }
      } catch {}
    };
    void resolveType();
    return () => { active = false; };
  }, [type]);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const interval = 15 * 60 * 1000;
    let lastAttempt = -Infinity;
    const loadWeather = async () => {
      if (document.hidden || controller || Date.now() - lastAttempt < interval) return;
      lastAttempt = Date.now();
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 10000);
      try {
        const response = await fetch("/api/weather", { signal: requestController.signal });
        if (!response.ok) throw new Error("Weather unavailable");
        const data: WeatherResponse = await response.json();
        if (active) setWeather(data);
      } catch {
        if (active) setWeather({ configured: false, error: "Počasí se nepodařilo načíst." });
      } finally {
        controller = null;
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };
    void loadWeather();
    const timer = window.setInterval(loadWeather, interval);
    document.addEventListener("visibilitychange", loadWeather);
    return () => { document.removeEventListener("visibilitychange", loadWeather); active = false; controller?.abort(); window.clearInterval(timer); };
  }, []);

  const current = weather?.error ? undefined : weather?.current;
  const selectedType = type ?? resolvedType;
  const strength = isStrengthActivity(selectedType);
  const advice = getActivityWeatherAdvice(current, selectedType);
  const title = loading && !current ? "Načítám počasí" : strength && current ? "Počasí v Dolní Lhotě" : advice.title;
  const text = loading && !current ? "Zjišťuji podmínky v Dolní Lhotě."
    : strength ? (current ? "Zobrazit podrobnou předpověď" : "Aktuální podmínky se nepodařilo načíst.") : advice.advice;
  const validWeather = Boolean(current && advice.temperature !== null && current.weatherCondition?.type);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const content = <section className={`run-weather-recommendation run-weather-compact run-weather-${strength ? "neutral" : advice.tone}${type ? " run-weather-home" : ""}`} aria-live="polite">
    <span className="run-weather-symbol">
      <span aria-hidden="true">
        {validWeather ? <WeatherVisual type={current?.weatherCondition?.type} size={48} night={hour < 6 || hour >= 20} /> : <CloudSun size={32} />}
      </span>
      {validWeather && <strong className="run-weather-temperature">{Math.round(advice.temperature!)} °C</strong>}
    </span>
    <div className="run-weather-copy">
      <div className="run-weather-heading"><strong>{title}</strong>{linkToWeather && <ChevronRight size={17} aria-hidden="true" />}</div>
      <p>{text}</p>
      {validWeather && <div className="run-weather-meta">
        <span>{current?.weatherCondition?.description?.text || weatherDescription(current?.weatherCondition?.type)}</span>
        <span>Vítr {Math.round(advice.wind)} km/h</span>
        {advice.rainChance > 0 && <span>Riziko srážek {Math.round(advice.rainChance)} %</span>}
      </div>}
    </div>
  </section>;
  return linkToWeather ? <Link href="/weather" className="run-weather-link" title="Podrobné počasí pro Dolní Lhotu">{content}</Link> : content;
}
