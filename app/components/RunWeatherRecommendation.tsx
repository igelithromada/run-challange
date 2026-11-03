"use client";

import React, { useEffect, useState } from "react";
import { CloudSun, CloudRain, CloudSnow, Sun, Wind, Footprints, AlertTriangle, CheckCircle2 } from "lucide-react";

type WeatherData = {
  current?: any;
  hourly?: any[];
  error?: string;
};

export default function RunWeatherRecommendation() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/weather", { cache: "no-store" });
        const data = await response.json();
        if (active) setWeather(data);
      } catch {
        if (active) setWeather({ error: "Počasí se nepodařilo načíst." });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const current = weather?.current;
  const condition = String(current?.weatherCondition?.type || "").toUpperCase();
  const temperature = Number(current?.temperature?.degrees);
  const wind = Number(current?.wind?.speed?.value || 0);
  const rainChance = Number(current?.precipitation?.probability?.percent ?? 0);
  const snow = condition.includes("SNOW") || condition.includes("SLEET");
  const rain = condition.includes("RAIN") || condition.includes("DRIZZLE") || condition.includes("THUNDER");
  const icy = temperature <= 0 && (snow || condition.includes("FREEZ"));
  const hot = temperature >= 28;
  const strongWind = wind >= 40;
  const heavyRain = rain && rainChance >= 60;

  let title = "Podmínky vypadají dobře";
  let advice = "Ideální čas vyrazit si zaběhat.";
  let tone = "good";
  let Icon: any = CheckCircle2;

  if (loading && !current) {
    title = "Zjišťuji podmínky pro běh";
    advice = "Načítám aktuální počasí pro Dolní Lhotu.";
    tone = "neutral";
    Icon = CloudSun;
  } else if (weather?.error || !current || !Number.isFinite(temperature)) {
    title = "Doporučení není dostupné";
    advice = weather?.error || "Aktuální počasí se nepodařilo načíst.";
    tone = "neutral";
    Icon = CloudSun;
  } else if (icy || heavyRain || strongWind || hot) {
    title = "Běh raději zvaž";
    tone = "warning";
    Icon = AlertTriangle;
    advice = icy ? "Mrzne a sněží – povrch může klouzat. Zvol opatrnou trasu a vhodnou obuv."
      : heavyRain ? "Déšť může zhoršit viditelnost i povrch cest. Zvaž kratší trasu nebo běh odlož."
      : strongWind ? "Silný vítr může běh výrazně znepříjemnit. Vyhni se otevřeným úsekům."
      : "Je poměrně horko. Zvol volnější tempo, kratší trasu a doplň tekutiny.";
  } else if (snow || rain || rainChance >= 40 || temperature < 3 || temperature > 24 || wind >= 25) {
    title = "Běhat se dá, ale s opatrností";
    advice = snow ? "Sníh může klouzat – obuj boty s dobrou podrážkou a přizpůsob tempo."
      : rain || rainChance >= 40 ? "Počítej s možností deště. Vezmi si vhodnou vrstvu a dávej pozor na kluzký povrch."
      : temperature < 3 ? "Je chladno. Vezmi si rukavice a vrstvy, které odvádějí pot."
      : temperature > 24 ? "Je tepleji. Zvol lehčí tempo a nezapomeň na pití."
      : "Může foukat nebo být chladněji. Přizpůsob oblečení a tempo.";
    tone = "caution";
    Icon = snow ? CloudSnow : rain ? CloudRain : Wind;
  }

  return (
    <section className={`run-weather-recommendation run-weather-${tone}`} aria-live="polite">
      <div className="run-weather-icon"><Icon size={27} /></div>
      <div className="run-weather-copy">
        <span className="run-weather-eyebrow"><Footprints size={14} /> Doporučení pro běh · Dolní Lhota</span>
        <strong>{title}</strong>
        <p>{advice}</p>
        {current && <small>{Math.round(temperature)} °C · vítr {Math.round(wind)} km/h{rainChance > 0 ? ` · srážky ${Math.round(rainChance)} %` : ""}</small>}
      </div>
    </section>
  );
}
