"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wind, Droplets, RefreshCw } from "lucide-react";
import type { WeatherResponse } from "../lib/weather";
import { formatPrecipitation, upcomingWeatherHours, weatherIsNight, weatherTime } from "../lib/weather";
import WeatherVisual, { weatherDescription } from "./WeatherVisual";

const REFRESH_MS = 15 * 60 * 1000;
const temperatureLabel = (value?: number) => typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}°` : "—";
const probabilityLabel = (value?: number | null) => typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)} %` : "—";

export default function WeatherCard() {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const loadWeather = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    setRefreshing(true);
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      // The server shares a 15-minute cache. Manual refresh does not bypass it.
      const response = await fetch("/api/weather", { cache: "no-cache", signal: controller.signal });
      const result: WeatherResponse = await response.json();
      if (!response.ok || result.error || !result.current) throw new Error(result.error || "Počasí se nepodařilo načíst.");
      if (mounted.current && request.current === controller) {
        setWeather(result);
        setNow(Date.now());
        setError("");
      }
    } catch (cause) {
      if (mounted.current && request.current === controller) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Počasí se nepodařilo načíst. Zkus to znovu.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadWeather();
    // Advance the first visible hour even while the page remains open.
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const refresh = window.setInterval(() => void loadWeather(), REFRESH_MS);
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      setNow(Date.now());
      if (Date.now() - lastAttempt.current >= REFRESH_MS) void loadWeather();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
      window.clearInterval(clock);
      window.clearInterval(refresh);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [loadWeather]);

  const current = weather?.current;
  const timeZone = weather?.timeZone?.id || "Europe/Prague";
  const hours = upcomingWeatherHours(weather?.hourly, now);
  const firstHour = hours[0];
  const wind = current?.wind?.speed?.value;
  const windUnit = current?.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? "km/h" : "m/s";
  const periodLabel = firstHour ? `${weatherTime(firstHour.interval?.startTime, timeZone)}–${weatherTime(firstHour.interval?.endTime, timeZone)}` : "Tato hodina";

  return <section className="tile weather-card weather-card-improved" aria-label="Předpověď počasí" aria-busy={refreshing}>
    {!current ? <p className="weather-loading" role="status">{error || "Načítám předpověď…"}</p> : <>
      <div className="weather-current-grid">
        <div className="weather-current-main">
          <div className="weather-current-icon-block">
            <WeatherVisual type={current.weatherCondition?.type} size={104} className="weather-main-icon" night={weatherIsNight(current, now, timeZone)} />
            <span>Dolní Lhota u Ostravy</span>
          </div>
          <div className="weather-current-copy">
            <strong className="weather-temperature">{temperatureLabel(current.temperature?.degrees)}{typeof current.temperature?.degrees === "number" ? "C" : ""}</strong>
            <span className="weather-description">{current.weatherCondition?.description?.text || weatherDescription(current.weatherCondition?.type)}</span>
            {typeof current.feelsLikeTemperature?.degrees === "number" && <small>Pocitově {temperatureLabel(current.feelsLikeTemperature.degrees)}C</small>}
          </div>
        </div>
        <div className="weather-stat-grid">
          <div className="weather-stat-card"><Wind size={24} /><strong>{typeof wind === "number" ? `${Math.round(wind)} ${windUnit}` : "—"}</strong><small>Vítr</small></div>
          <div className="weather-stat-card weather-precipitation-stat" title={`Očekávané srážky ${periodLabel}. Množství a pravděpodobnost platí pro stejné období.`}>
            <WeatherVisual type="RAIN" size={28} />
            <strong>{formatPrecipitation(firstHour?.precipitation?.amount)}</strong>
            <small>Srážky {periodLabel}<br />Pravděp. {probabilityLabel(firstHour?.precipitation?.probability?.percent)}</small>
          </div>
          <div className="weather-stat-card"><Droplets className="weather-humidity-icon" size={24} /><strong>{probabilityLabel(current.relativeHumidity)}</strong><small>Vlhkost</small></div>
        </div>
      </div>
      {hours.length > 0 ? <section className="weather-hour-section" aria-labelledby="weather-hour-heading">
        <h3 id="weather-hour-heading">Předpověď po hodinách</h3>
        <div className="weather-hour-grid weather-hour-scroll" tabIndex={0} role="group" aria-label="Předpověď na 12 hodin, posouvej doleva nebo doprava">
          {hours.map(item => {
            const start = Date.parse(item.interval?.startTime || "");
            const end = Date.parse(item.interval?.endTime || "") || start + 3600000;
            const activeHour = start <= now && now < end;
            const period = `${weatherTime(item.interval?.startTime, timeZone)}–${weatherTime(item.interval?.endTime, timeZone)}`;
            return <div key={item.interval?.startTime} className="weather-hour-card" title={`Předpověď pro ${period}`}>
              <small className="weather-hour-time">{activeHour ? "Teď" : weatherTime(item.interval?.startTime, timeZone)}</small>
              <div className="weather-hour-main"><WeatherVisual type={item.weatherCondition?.type} size={48} className="weather-hour-icon" night={weatherIsNight(item, item.interval?.startTime || now, timeZone)} /><strong>{temperatureLabel(item.temperature?.degrees)}</strong></div>
              <strong className="weather-hour-amount">{formatPrecipitation(item.precipitation?.amount)}</strong>
              <span>Pravděp. {probabilityLabel(item.precipitation?.probability?.percent)}</span>
            </div>;
          })}
        </div>
        <p className="weather-precipitation-note">mm = očekávané množství srážek za hodinu · % = pravděpodobnost srážek</p>
      </section> : <p className="weather-message">Aktuální hodinová předpověď není dostupná. Obnov počasí.</p>}
      <p className="weather-source">Zdroj: {weather?.source || "Open-Meteo"} · data načtena {weatherTime(weather?.fetchedAt, timeZone)}</p>
    </>}
    <div className="weather-refresh-row">
      {current && error && <p className="weather-refresh-error" role="status">{error} Zobrazuji poslední dostupná data.</p>}
      <button type="button" className="ui-icon-button weather-refresh-button" disabled={refreshing} onClick={() => void loadWeather()} aria-label="Obnovit počasí" title="Obnovit počasí"><RefreshCw size={18} /></button>
    </div>
  </section>;
}
