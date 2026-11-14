"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeatherHour, WeatherResponse } from "../lib/weather";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Wind, Droplets, RefreshCw } from "lucide-react";
import RunWeatherRecommendation from "../components/RunWeatherRecommendation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function isRainType(type = "") {
  const value = type.toUpperCase();
  return value.includes("RAIN") || value.includes("DRIZZLE") || value.includes("THUNDER");
}
function weatherKind(type = "") {
  const value = type.toUpperCase();
  if (value.includes("THUNDER")) return "storm";
  if (value.includes("SNOW") || value.includes("SLEET") || value.includes("HAIL")) return "snow";
  if (value.includes("RAIN")) return "rain";
  if (value.includes("DRIZZLE")) return "drizzle";
  if (value.includes("FOG") || value.includes("HAZE")) return "fog";
  if (value.includes("PARTLY") || value.includes("MOSTLY")) return "partly";
  if (value.includes("CLOUD")) return "cloud";
  if (value.includes("CLEAR") || value.includes("SUN")) return "sun";
  return "partly";
}
function WeatherVisual({ type, size, className = "" }: { type?: string; size: number; className?: string }) {
  const kind = weatherKind(type);
  const Icon = kind === "storm" ? CloudLightning : kind === "snow" ? CloudSnow : kind === "rain" ? CloudRain : kind === "drizzle" ? CloudDrizzle : kind === "fog" ? CloudFog : kind === "cloud" ? Cloud : Sun;
  return <span className={`weather-visual-wrap weather-visual-${kind} ${className}`} style={{ width: size, height: size }}>
    {kind === "partly" ? <><Sun className="weather-sun" size={Math.round(size * .58)} strokeWidth={1.7} /><Cloud className="weather-cloud" size={Math.round(size * .68)} strokeWidth={1.8} /></> : <Icon className="weather-visual-icon" size={Math.round(size * .72)} strokeWidth={1.7} />}
  </span>;
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
  const [weatherTest, setWeatherTest] = useState<string>("");
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
    try { setWeatherTest(localStorage.getItem("dolni-lhota-weather-test-v1") || ""); } catch {}
    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const setWeatherTestMode = (mode: "wind" | "rain" | "clear" | "storm" | "") => {
    setWeatherTest(mode);
    try {
      if (mode) localStorage.setItem("dolni-lhota-weather-test-v1", mode);
      else localStorage.removeItem("dolni-lhota-weather-test-v1");
    } catch {}
    const root = document.documentElement;
    if (mode) {
      root.setAttribute("data-weather", mode);
      root.setAttribute("data-windy", mode === "wind" ? "true" : "false");
    } else {
      const condition = String(weather?.current?.weatherCondition?.type || "").toUpperCase();
      const wind = Number(weather?.current?.wind?.speed?.value || 0);
      const isRain = condition.includes("RAIN") || condition.includes("DRIZZLE") || condition.includes("THUNDER");
      const isSnow = condition.includes("SNOW") || condition.includes("SLEET") || condition.includes("HAIL");
      let realWeather = "clear";
      if (isSnow) realWeather = wind >= 8 ? "snow-wind" : "snow";
      else if (isRain) realWeather = wind >= 8 ? "rain-wind" : "rain";
      else if (condition.includes("FOG")) realWeather = "fog";
      else if (wind >= 8) realWeather = "wind";
      else if (condition.includes("CLOUD")) realWeather = "cloudy";
      else if (new Date().getHours() < 6 || new Date().getHours() >= 20) realWeather = "night";
      root.setAttribute("data-weather", realWeather);
      root.setAttribute("data-windy", wind >= 8 ? "true" : "false");
    }
  };
  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "home") router.push("/");
    else if (item === "weather") router.push("/weather");
    else if (item === "settings") router.push("/settings");
    else if (item === "routes") router.push("/routes");
    else router.push("/");
  };
  const current = weather?.current;
  const condition = current?.weatherCondition;
  const hours = (weather?.hourly || []).slice(0, 8);
  const temperature = current?.temperature?.degrees;
  const feelsLike = current?.feelsLikeTemperature?.degrees;
  const wind = current?.wind?.speed?.value;
  const windUnit = current?.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? "km/h" : "m/s";
  const rainValues = [current?.precipitation?.probability?.percent, ...hours.slice(0, 6).map(item => item?.precipitation?.probability?.percent)].filter(value => typeof value === "number");
  const rainChance = rainValues.length ? Math.max(...rainValues) : undefined;
  const currentRainMm = current?.precipitation?.amount;
  const humidity = current?.relativeHumidity;
  return (
    <>
      <Navbar title="Počasí" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container weather-page">
        <section className="tile weather-card weather-card-improved" aria-label="Předpověď počasí">
      <div className="weather-card-heading"><div><h2>Počasí pro pohyb</h2><p>Dolní Lhota u Ostravy</p></div><button type="button" className="ui-icon-button weather-refresh-button" onClick={() => void loadWeather(true)} aria-label="Obnovit počasí" title="Obnovit počasí"><RefreshCw size={18} /></button></div>
      {loading && !weather ? <p className="weather-loading">Načítám předpověď…</p> : !weather?.configured ? <div className="weather-message"><strong>Google Počasí čeká na propojení</strong><p>Je potřeba doplnit klíč Google Weather API do nastavení projektu na Vercelu.</p></div> : weather?.error || !current ? <p className="weather-message">{weather?.error || "Předpověď není momentálně dostupná."}</p> : (
        <>
          <RunWeatherRecommendation linkToWeather={false} />

          <div className="weather-test-controls" aria-label="Test animací počasí">
            <span>Test animací:</span>
            <button type="button" className={weatherTest === "wind" ? "active" : ""} onClick={() => setWeatherTestMode("wind")}><Wind size={15}/> Vítr</button>
            <button type="button" className={weatherTest === "rain" ? "active" : ""} onClick={() => setWeatherTestMode("rain")}><CloudRain size={15}/> Déšť</button>
            <button type="button" className={weatherTest === "clear" ? "active" : ""} onClick={() => setWeatherTestMode("clear")}><Sun size={15}/> Slunečno</button>
            <button type="button" className={weatherTest === "storm" ? "active" : ""} onClick={() => setWeatherTestMode("storm")}><CloudLightning size={15}/> Bouřka</button>
            <button type="button" className={!weatherTest ? "active" : ""} onClick={() => setWeatherTestMode("")}>Reálné počasí</button>
          </div>

          <div className="weather-current-grid">
            <div className="weather-current-main"><WeatherVisual type={condition?.type} size={74} className="weather-main-icon" /><div className="weather-current-copy"><strong className="weather-temperature">{Math.round(temperature ?? 0)}°C</strong><span className="weather-description">{condition?.description?.text || "Aktuální počasí"}</span>{feelsLike !== undefined && <small>Pocitově {Math.round(feelsLike)}°C</small>}</div></div>
            <div className="weather-stat-grid">
              <div className="weather-stat-card"><Wind size={19} className="wind-icon-animated" /><strong>{wind !== undefined ? Math.round(wind) : "—"} {wind !== undefined ? windUnit : ""}</strong><small>Vítr</small></div>
              <div className="weather-stat-card"><RainIcon size={19} className="weather-stat-icon" /><strong>{rainChance !== undefined ? `${rainChance}%` : "—"}</strong><small>{formatMm(currentRainMm)} · Déšť</small></div>
              <div className="weather-stat-card"><Droplets className="weather-humidity-icon" size={19} /><strong>{humidity !== undefined ? `${humidity}%` : "—"}</strong><small>Vlhkost</small></div>
            </div>
          </div>
          {hours.length > 0 && <section className="weather-hour-section"><h3>Předpověď po hodinách</h3><div className="weather-hour-grid">{hours.map((item,index) => { const kind = weatherKind(item?.weatherCondition?.type); return <div key={item?.interval?.startTime || index} className={`weather-hour-card weather-hour-${kind}`}><span className="weather-hour-animation" aria-hidden="true" /><small>{hourLabel(item)}</small>{isRainType(item?.weatherCondition?.type) ? <RainIcon size={27} className="weather-hour-icon" /> : <WeatherVisual type={item?.weatherCondition?.type} size={27} className="weather-hour-icon" />}<strong>{Math.round(item?.temperature?.degrees ?? 0)}°</strong><span>{item?.precipitation?.probability?.percent !== undefined && item?.precipitation?.probability?.percent !== null ? `${item.precipitation.probability.percent}% déšť` : "—"}</span>{item?.precipitation?.amount !== undefined && item?.precipitation?.amount !== null && <small>{formatMm(item.precipitation.amount)}</small>}</div>; })}</div></section>}
          <p className="weather-source">Zdroj: {weather.source || "Google Weather"} · obnoveno {lastUpdated}</p>
        </>
      )}
        </section>
      </main>
    </>
  );
}