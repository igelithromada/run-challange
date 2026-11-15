"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeatherHour, WeatherResponse } from "../lib/weather";
import { Cloud, Wind, Droplets, RefreshCw } from "lucide-react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import WeatherVisual, { weatherDescription } from "../components/WeatherVisual";

function isRainType(type = "") {
  const value = type.toUpperCase();
  return value.includes("RAIN") || value.includes("DRIZZLE") || value.includes("THUNDER");
}
function RainIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return <span className={`weather-rain-combo ${className}`} style={{ width: size, height: size }}><Cloud size={size} strokeWidth={1.8} /><Droplets className="weather-rain-drops" size={Math.max(10, Math.round(size * .55))} strokeWidth={2.4} /></span>;
}
function hourLabel(item: WeatherHour) {
  const raw = item?.displayDateTime;
  if (raw?.hours !== undefined) return `${String(raw.hours).padStart(2, "0")}:00`;
  const date = item?.interval?.startTime ? new Date(item.interval.startTime) : null;
  return date ? date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }) : "—";
}
function formatMm(value?: number | null) { return value !== undefined && value !== null ? `${value.toFixed(value >= 10 ? 0 : 1)} mm` : "—"; }

export default function WeatherCard() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const loadWeather = async (forceRefresh = false) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/weather", { ...(forceRefresh ? { cache: "reload" as RequestCache } : {}), signal: controller.signal });
      const data = await response.json();
      setWeather(data);
      setLastUpdated(new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setWeather({ configured: true, error: "Počasí se nepodařilo načíst. Zkus to později." });
    } finally { window.clearTimeout(timeout); setLoading(false); }
  };
  useEffect(() => {
    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const handleSelect = (item: string) => {
    setMenuVisible(false);
    const routes: Record<string, string> = {
      home: "/", myrun: "/myruns", teams: "/teams", challenges: "/challenges",
      progress: "/progress", trainer: "/trainer", statistics: "/statistics",
      participants: "/participants", weather: "/weather", routes: "/routes",
      settings: "/settings", admin: "/admin",
    };
    if (item === "logout") {
      void import("firebase/auth").then(({ signOut }) => signOut(auth)).then(() => router.push("/login"));
      return;
    }
    router.push(routes[item] || "/");
  };
  const current = weather?.current;
  const condition = current?.weatherCondition;
  const hours = (weather?.hourly || []).slice(0, 6);
  const temperature = current?.temperature?.degrees;
  const feelsLike = current?.feelsLikeTemperature?.degrees;
  const wind = current?.wind?.speed?.value;
  const windUnit = current?.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? "km/h" : "m/s";
  const rainValues = [current?.precipitation?.probability?.percent, ...hours.slice(0, 6).map(item => item?.precipitation?.probability?.percent)].filter(value => typeof value === "number");
  const rainChance = rainValues.length ? Math.max(...rainValues) : undefined;
  const currentRainMm = current?.precipitation?.amount;
  const currentHour = new Date().getHours();
  const currentIsNight = currentHour < 6 || currentHour >= 20;
  const humidity = current?.relativeHumidity;
  return (
    <>
      <Navbar title="Počasí" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container weather-page">
        <section className="tile weather-card weather-card-improved" aria-label="Předpověď počasí">
      <div className="weather-card-heading"><span aria-hidden="true" /><button type="button" className="ui-icon-button weather-refresh-button" onClick={() => void loadWeather(true)} aria-label="Obnovit počasí" title="Obnovit počasí"><RefreshCw size={18} /></button></div>
      {loading && !weather ? <p className="weather-loading">Načítám předpověď…</p> : !weather?.configured ? <div className="weather-message"><strong>Google Počasí čeká na propojení</strong><p>Je potřeba doplnit klíč Google Weather API do nastavení projektu na Vercelu.</p></div> : weather?.error || !current ? <p className="weather-message">{weather?.error || "Předpověď není momentálně dostupná."}</p> : (
        <>
          <div className="weather-current-grid">
            <div className="weather-current-main"><div className="weather-current-icon-block"><WeatherVisual type={condition?.type} size={104} className="weather-main-icon" night={currentIsNight} /><span>Dolní Lhota u Ostravy</span></div><div className="weather-current-copy"><strong className="weather-temperature">{Math.round(temperature ?? 0)}°C</strong><span className="weather-description">{weatherDescription(condition?.type)}</span>{feelsLike !== undefined && <small>Pocitově {Math.round(feelsLike)}°C</small>}</div></div>
            <div className="weather-stat-grid">
              <div className="weather-stat-card"><Wind size={19} /><strong>{wind !== undefined ? Math.round(wind) : "—"} {wind !== undefined ? windUnit : ""}</strong><small>Vítr</small></div>
              <div className="weather-stat-card"><RainIcon size={19} className="weather-stat-icon" /><strong>{rainChance !== undefined ? `${rainChance}%` : "—"}</strong><small>{formatMm(currentRainMm)} · Déšť</small></div>
              <div className="weather-stat-card"><Droplets className="weather-humidity-icon" size={19} /><strong>{humidity !== undefined ? `${humidity}%` : "—"}</strong><small>Vlhkost</small></div>
            </div>
          </div>
          {hours.length > 0 && <section className="weather-hour-section"><h3>Předpověď po hodinách</h3><div className="weather-hour-grid">{hours.map((item,index) => { return <div key={item?.interval?.startTime || index} className="weather-hour-card"><small className="weather-hour-time">{hourLabel(item)}</small><div className="weather-hour-main">{isRainType(item?.weatherCondition?.type) ? <RainIcon size={42} className="weather-hour-icon" /> : <WeatherVisual type={item?.weatherCondition?.type} size={48} className="weather-hour-icon" night={(() => { const raw = item?.displayDateTime?.hours; if (raw !== undefined) return raw < 6 || raw >= 20; const date = item?.interval?.startTime ? new Date(item.interval.startTime) : null; const hour = date ? date.getHours() : currentHour; return hour < 6 || hour >= 20; })()} />}<strong>{Math.round(item?.temperature?.degrees ?? 0)}°</strong></div><span>{item?.precipitation?.probability?.percent !== undefined && item?.precipitation?.probability?.percent !== null ? `${item.precipitation.probability.percent}% déšť` : "—"}</span>{item?.precipitation?.amount !== undefined && item?.precipitation?.amount !== null && <small>{formatMm(item.precipitation.amount)}</small>}</div>; })}</div></section>}
          <p className="weather-source">Zdroj: {weather.source || "Google Weather"} · obnoveno {lastUpdated}</p>
        </>
      )}
        </section>
      </main>
    </>
  );
}