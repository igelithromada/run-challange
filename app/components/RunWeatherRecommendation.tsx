"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, CloudSun } from "lucide-react";
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
    const loadWeather = async () => {
      controller?.abort();
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
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };
    void loadWeather();
    const timer = window.setInterval(loadWeather, 30 * 60 * 1000);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, []);

  const current = weather?.error ? undefined : weather?.current;
  const advice = getActivityWeatherAdvice(current, type ?? resolvedType);
  const validWeather = Boolean(current && advice.temperature !== null && current.weatherCondition?.type);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const content = <section className={`run-weather-recommendation run-weather-compact run-weather-${advice.tone}`} aria-live="polite">
    <span className="run-weather-symbol" aria-hidden="true">
      {validWeather ? <WeatherVisual type={current?.weatherCondition?.type} size={48} night={hour < 6 || hour >= 20} /> : <CloudSun size={32} />}
    </span>
    <div className="run-weather-copy">
      <div className="run-weather-heading"><strong>{loading && !current ? "Načítám počasí" : advice.title}</strong>{linkToWeather && <ChevronRight size={17} aria-hidden="true" />}</div>
      <p>{loading && !current ? "Zjišťuji podmínky v Dolní Lhotě." : advice.advice}</p>
      {validWeather && <div className="run-weather-meta">
        <span>{Math.round(advice.temperature!)} °C · {weatherDescription(current?.weatherCondition?.type)}</span>
        <span>Vítr {Math.round(advice.wind)} km/h</span>
        {advice.rainChance > 0 && <span>Srážky {Math.round(advice.rainChance)} %</span>}
      </div>}
    </div>
  </section>;
  return linkToWeather ? <Link href="/weather" className="run-weather-link" title="Podrobné počasí pro Dolní Lhotu">{content}</Link> : content;
}
