"use client";

import React, { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow,
  CloudSun, Sun, Wind, Droplets, Thermometer, RefreshCw
} from "lucide-react";

type WeatherResponse = {
  configured: boolean;
  source?: string;
  current?: any;
  hourly?: any[];
  timeZone?: { id?: string };
  fetchedAt?: string;
  error?: string;
};

function conditionIcon(type = "") {
  const value = type.toUpperCase();
  if (value.includes("THUNDER")) return CloudLightning;
  if (value.includes("SNOW") || value.includes("SLEET") || value.includes("HAIL")) return CloudSnow;
  if (value.includes("RAIN")) return CloudRain;
  if (value.includes("DRIZZLE")) return CloudDrizzle;
  if (value.includes("FOG") || value.includes("HAZE")) return CloudFog;
  if (value.includes("CLOUDY") && (value.includes("PARTLY") || value.includes("MOSTLY"))) return CloudSun;
  if (value.includes("CLOUD")) return Cloud;
  if (value.includes("CLEAR") || value.includes("SUN")) return Sun;
  return CloudSun;
}

function hourLabel(item: any) {
  const raw = item?.displayDateTime;
  if (raw?.hours !== undefined) return `${String(raw.hours).padStart(2, "0")}:00`;
  const date = item?.interval?.startTime ? new Date(item.interval.startTime) : null;
  return date ? date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }) : "—";
}

export default function WeatherCard() {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadWeather = async (forceRefresh = false) => {
    try {
      const response = await fetch("/api/weather", forceRefresh ? { cache: "reload" } : undefined);
      const data = await response.json();
      setWeather(data);
      setLastUpdated(new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setWeather({ configured: true, error: "Počasí se nepodařilo načíst. Zkus to později." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
    const timer = window.setInterval(loadWeather, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const current = weather?.current;
  const condition = current?.weatherCondition;
  const Icon = conditionIcon(condition?.type);
  const hours = (weather?.hourly || []).slice(0, 8);
  const temperature = current?.temperature?.degrees;
  const feelsLike = current?.feelsLikeTemperature?.degrees;
  const wind = current?.wind?.speed?.value;
  const windUnit = current?.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? "km/h" : "m/s";
  const rainChance = current?.precipitation?.probability?.percent;

  return (
    <section className="tile" style={{ marginBottom: "1.25rem", overflow: "hidden" }} aria-label="Předpověď počasí">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Počasí pro běh</h2>
          <p style={{ margin: "0.2rem 0 0", opacity: 0.78, fontSize: "0.85rem" }}>Dolní Lhota u Ostravy</p>
        </div>
        <button type="button" onClick={() => void loadWeather(true)} aria-label="Obnovit počasí" title="Obnovit počasí" style={{ background: "rgba(255,255,255,0.16)", border: 0, borderRadius: 999, color: "inherit", padding: "0.55rem", cursor: "pointer" }}>
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && !weather ? (
        <p style={{ margin: "1.2rem 0 0" }}>Načítám předpověď…</p>
      ) : !weather?.configured ? (
        <div style={{ marginTop: "1rem", padding: "0.85rem", borderRadius: "12px", background: "rgba(0,0,0,0.12)" }}>
          <strong>Google Počasí čeká na propojení</strong>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>Je potřeba doplnit klíč Google Weather API do nastavení projektu na Vercelu.</p>
        </div>
      ) : weather?.error || !current ? (
        <p style={{ margin: "1rem 0 0" }}>{weather?.error || "Předpověď není momentálně dostupná."}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.25rem 0" }}>
            <Icon size={54} strokeWidth={1.5} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "2.6rem", lineHeight: 1, fontWeight: 700 }}>{Math.round(temperature ?? 0)}°C</div>
              <div style={{ marginTop: "0.35rem", fontWeight: 600 }}>{condition?.description?.text || "Aktuální počasí"}</div>
              {feelsLike !== undefined && <div style={{ opacity: 0.78, fontSize: "0.85rem" }}>Pocitově {Math.round(feelsLike)}°C</div>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "1.1rem" }}>
            <div style={{ background: "rgba(0,0,0,0.12)", borderRadius: "12px", padding: "0.65rem 0.5rem", textAlign: "center" }}>
              <Wind size={19} className="wind-icon-animated" style={{ margin: "0 auto 0.25rem" }} />
              <strong style={{ display: "block" }}>{wind !== undefined ? Math.round(wind) : "—"} {wind !== undefined ? windUnit : ""}</strong>
              <small>Vítr</small>
            </div>
            <div style={{ background: "rgba(0,0,0,0.12)", borderRadius: "12px", padding: "0.65rem 0.5rem", textAlign: "center" }}>
              <CloudRain size={19} style={{ margin: "0 auto 0.25rem" }} />
              <strong style={{ display: "block" }}>{rainChance !== undefined ? `${rainChance}%` : "—"}</strong>
              <small>Déšť</small>
            </div>
            <div style={{ background: "rgba(0,0,0,0.12)", borderRadius: "12px", padding: "0.65rem 0.5rem", textAlign: "center" }}>
              <Droplets size={19} style={{ margin: "0 auto 0.25rem" }} />
              <strong style={{ display: "block" }}>{current.relativeHumidity !== undefined ? `${current.relativeHumidity}%` : "—"}</strong>
              <small>Vlhkost</small>
            </div>
          </div>

          {hours.length > 0 && (
            <>
              <h3 style={{ margin: "0 0 0.65rem", fontSize: "1rem" }}>Předpověď po hodinách</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
                {hours.map((item, index) => {
                  const HourIcon = conditionIcon(item?.weatherCondition?.type);
                  return (
                    <div key={item?.interval?.startTime || index} style={{ textAlign: "center", padding: "0.6rem 0.25rem", borderRadius: "12px", background: "rgba(0,0,0,0.12)" }}>
                      <small>{hourLabel(item)}</small>
                      <HourIcon size={23} style={{ display: "block", margin: "0.35rem auto" }} />
                      <strong>{Math.round(item?.temperature?.degrees ?? 0)}°</strong>
                      <small style={{ display: "block", opacity: 0.8 }}>{item?.precipitation?.probability?.percent ?? 0}% déšť</small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p style={{ margin: "0.85rem 0 0", fontSize: "0.72rem", opacity: 0.7, textAlign: "right" }}>Zdroj: {weather.source || "Google Weather"} · obnoveno {lastUpdated}</p>
        </>
      )}
    </section>
  );
}
