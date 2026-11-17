"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wind, Droplets, RefreshCw, MapPin } from "lucide-react";
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
  const [refreshStatus, setRefreshStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [usingGps, setUsingGps] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationRef = useRef<{ lat: number; lon: number } | null>(null);
  const locationVersion = useRef(0);
  const lastObserved = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const loadWeather = useCallback(async (forceRefresh = false) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    setRefreshing(true);
    setRefreshStatus("");
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      // Explicit refresh bypasses both the CDN and the upstream Next.js cache.
      const query = new URLSearchParams();
      if (locationRef.current) { query.set("lat", String(locationRef.current.lat)); query.set("lon", String(locationRef.current.lon)); }
      if (forceRefresh) { query.set("refresh", "1"); query.set("request", String(Date.now())); }
      const response = await fetch(`/api/weather${query.size ? `?${query}` : ""}`, { cache: forceRefresh ? "no-store" : "no-cache", signal: controller.signal });
      const result: WeatherResponse = await response.json();
      if (!response.ok || result.error || !result.current) throw new Error(result.error || "Počasí se nepodařilo načíst.");
      if (mounted.current && request.current === controller) {
        if (forceRefresh) setRefreshStatus(lastObserved.current && lastObserved.current === result.observedAt
          ? `Novější údaje zatím nejsou dostupné · čas dat ${weatherTime(result.observedAt, result.timeZone?.id)}`
          : `Počasí obnoveno · čas dat ${weatherTime(result.observedAt, result.timeZone?.id)}`);
        lastObserved.current = result.observedAt;
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

  const chooseLocation = (gps: boolean) => {
    const version = ++locationVersion.current;
    setLocationError("");
    const apply = (position: { lat: number; lon: number } | null) => {
      if (!mounted.current || version !== locationVersion.current) return;
      request.current?.abort(); request.current = null;
      locationRef.current = position; lastObserved.current = undefined;
      setUsingGps(!!position); setLocating(false); setWeather(null);
      void loadWeather();
    };
    if (!gps) { apply(null); return; }
    if (!("geolocation" in navigator)) { setLocationError("Telefon nepodporuje určení polohy."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => apply({ lat: Math.round(position.coords.latitude * 100) / 100, lon: Math.round(position.coords.longitude * 100) / 100 }), () => {
      if (!mounted.current || version !== locationVersion.current) return;
      setLocating(false); setLocationError("Polohu se nepodařilo získat. Povol polohu v telefonu, nebo použij Dolní Lhotu.");
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 });
  };

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
      ++locationVersion.current;
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
  const hours = upcomingWeatherHours(weather?.hourly, now, 24)
    .filter(item => Date.parse(item.interval?.startTime || "") > now).slice(0, 12);
  const wind = current?.wind?.speed?.value;
  const windUnit = current?.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? "km/h" : "m/s";
  const observedTime = Date.parse(weather?.observedAt || "");
  const observedPeriod = Number.isFinite(observedTime)
    ? `${weatherTime(new Date(observedTime - 15 * 60000).toISOString(), timeZone)}–${weatherTime(weather?.observedAt, timeZone)}`
    : "posledních 15 minut";

  return <section className="tile weather-card weather-card-improved" aria-label="Předpověď počasí" aria-busy={refreshing}>
    <div className="weather-location-selector" role="group" aria-label="Místo předpovědi">
      <button type="button" aria-pressed={!usingGps} onClick={() => chooseLocation(false)}>Dolní Lhota</button>
      <button type="button" aria-pressed={!!usingGps} disabled={!!locating} onClick={() => chooseLocation(true)}><MapPin size={16} />{locating ? "Zjišťuji polohu…" : "Moje poloha"}</button>
    </div>
    {locationError && <p className="weather-precipitation-note" role="status">{locationError}</p>}
    {!current ? <p className="weather-loading" role="status">{error || "Načítám předpověď…"}</p> : <>
      <div className="weather-current-grid">
        <div className="weather-current-main">
          <div className="weather-current-icon-block">
            <WeatherVisual type={current.weatherCondition?.type} size={104} className="weather-main-icon" night={weatherIsNight(current, now, timeZone)} />
            <span>{weather?.locationName || "Dolní Lhota u Ostravy"}</span>
          </div>
          <div className="weather-current-copy">
            <small>Aktuálně{Number.isFinite(observedTime) ? ` · ${weatherTime(weather?.observedAt, timeZone)}` : ""}</small>
            <strong className="weather-temperature">{temperatureLabel(current.temperature?.degrees)}{typeof current.temperature?.degrees === "number" ? "C" : ""}</strong>
            <span className="weather-description">{current.weatherCondition?.description?.text || weatherDescription(current.weatherCondition?.type)}</span>
            {typeof current.feelsLikeTemperature?.degrees === "number" && <small>Pocitově {temperatureLabel(current.feelsLikeTemperature.degrees)}C</small>}
          </div>
        </div>
        <div className="weather-stat-grid">
          <div className="weather-stat-card"><Wind size={24} /><strong>{typeof wind === "number" ? `${Math.round(wind)} ${windUnit}` : "—"}</strong><small>Vítr</small></div>
          <div className="weather-stat-card weather-precipitation-stat" title={`Aktuální odhad úhrnu srážek za ${observedPeriod}. Pravděpodobnost budoucích srážek je uvedena v hodinové předpovědi.`}>
            <Droplets className="weather-humidity-icon" size={28} />
            <strong>{formatPrecipitation(current.precipitation?.amount)}</strong>
            <small>Srážky</small>
          </div>
          <div className="weather-stat-card"><Droplets className="weather-humidity-icon" size={24} /><strong>{probabilityLabel(current.relativeHumidity)}</strong><small>Vlhkost</small></div>
        </div>
      </div>
      {hours.length > 0 ? <section className="weather-hour-section" aria-labelledby="weather-hour-heading">
        <h3 id="weather-hour-heading">Předpověď po hodinách</h3>
        <div className="weather-hour-grid weather-hour-scroll" tabIndex={0} role="group" aria-label="Předpověď na 12 hodin, posouvej doleva nebo doprava">
          {hours.map(item => {
            const period = `${weatherTime(item.interval?.startTime, timeZone)}–${weatherTime(item.interval?.endTime, timeZone)}`;
            return <div key={item.interval?.startTime} className="weather-hour-card" title={`Předpověď pro ${period}`}>
              <small className="weather-hour-time">{weatherTime(item.interval?.startTime, timeZone)}</small>
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
      {refreshStatus && <p className="weather-precipitation-note" role="status">{refreshStatus}</p>}
      {current && error && <p className="weather-refresh-error" role="status">{error} Zobrazuji poslední dostupná data.</p>}
      <button type="button" className="ui-icon-button weather-refresh-button" disabled={refreshing} onClick={() => void loadWeather(true)} aria-label="Obnovit počasí" title="Obnovit počasí"><RefreshCw size={18} />{refreshing && <span className="sr-only">Obnovuji počasí…</span>}</button>
    </div>
  </section>;
}
