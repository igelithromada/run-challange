"use client";

import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { WeatherResponse } from "../lib/weather";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import Link from "next/link";
import { CloudSun, CloudRain, CloudSnow, Wind, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ActivityType, ActivityTypeIcon } from "./ActivityTypeSelector";

export default function RunWeatherRecommendation({
  linkToWeather = true,
  type,
}: {
  linkToWeather?: boolean;
  type?: ActivityType;
}) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [resolvedType, setResolvedType] = useState<ActivityType>(type || "běh");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const resolveType = async () => {
      if (type) { setResolvedType(type); return; }
      try {
        const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
        if (cached === "běh" || cached === "chůze") setResolvedType(cached);
        const user = auth.currentUser;
        if (user) {
          const profile = await getDoc(doc(db, "users", user.uid));
          if (profile.exists() && profile.data().defaultActivity === "chůze") setResolvedType("chůze");
          else if (profile.exists()) setResolvedType("běh");
        }
      } catch {}
    };
    void resolveType();
    const load = async () => {
      try {
        const response = await fetch("/api/weather");
        if (!response.ok) throw new Error("Počasí se nepodařilo načíst.");
        const data = await response.json();
        if (active) setWeather(data);
      } catch {
        if (active) setWeather({ error: "Počasí se nepodařilo načíst." });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [type]);

  const current = weather?.current;
  const condition = String(current?.weatherCondition?.type || "").toUpperCase();
  const temperature = Number(current?.temperature?.degrees);
  const wind = Number(current?.wind?.speed?.value || 0);
  const rainChance = Number(current?.precipitation?.probability?.percent ?? 0);
  const snow = condition.includes("SNOW") || condition.includes("SLEET");
  const rain = condition.includes("RAIN") || condition.includes("DRIZZLE") || condition.includes("THUNDER");
  const icy = temperature <= 0 && (snow || condition.includes("FREEZ"));
  const activityType = type ?? resolvedType;
  const hot = activityType === "chůze" ? temperature >= 30 : temperature >= 28;
  const strongWind = activityType === "chůze" ? wind >= 45 : wind >= 40;
  const heavyRain = rain && rainChance >= 60;
  const activityName = activityType === "chůze" ? "chůzi" : "běh";
  const ActivityIcon = () => <ActivityTypeIcon type={activityType} size={18} />;

  let title = "Podmínky vypadají dobře";
  let advice = activityType === "chůze" ? "Ideální čas vyrazit na chůzi." : "Ideální čas vyrazit si zaběhat.";
  let tone = "good";
  let Icon: LucideIcon = CheckCircle2;

  if (loading && !current) {
    title = `Zjišťuji podmínky pro ${activityName}`;
    advice = "Načítám aktuální počasí pro Dolní Lhotu.";
    tone = "neutral"; Icon = CloudSun;
  } else if (weather?.error || !current || !Number.isFinite(temperature)) {
    title = "Doporučení není dostupné";
    advice = weather?.error || "Aktuální počasí se nepodařilo načíst.";
    tone = "neutral"; Icon = CloudSun;
  } else if (icy || heavyRain || strongWind || hot) {
    title = activityType === "chůze" ? "Chůzi raději zvaž" : "Běh raději zvaž";
    tone = "warning"; Icon = AlertTriangle;
    advice = icy ? "Mrzne a sněží – povrch může klouzat. Zvol opatrnou trasu a vhodnou obuv."
      : heavyRain ? "Déšť může zhoršit viditelnost i povrch cest. Zvaž kratší trasu nebo aktivitu odlož."
      : strongWind ? "Silný vítr může aktivitu výrazně znepříjemnit. Vyhni se otevřeným úsekům."
      : activityType === "chůze" ? "Je poměrně horko. Vyraz raději v chladnější části dne a vezmi si vodu."
      : "Je poměrně horko. Zvol volnější tempo, kratší trasu a doplň tekutiny.";
  } else if (snow || rain || rainChance >= 40 || temperature < 3 || temperature > 24 || wind >= 25) {
    title = activityType === "chůze" ? "Chůze je možná, ale s opatrností" : "Běhat se dá, ale s opatrností";
    tone = "caution";
    Icon = snow ? CloudSnow : rain ? CloudRain : Wind;
    advice = snow ? "Sníh může klouzat – obuj boty s dobrou podrážkou a přizpůsob tempo."
      : rain || rainChance >= 40 ? "Počítej s možností deště. Vezmi si vhodnou vrstvu a dávej pozor na kluzký povrch."
      : temperature < 3 ? "Je chladno. Vezmi si teplou vrstvu a podle podmínek rukavice."
      : temperature > 24 ? "Je tepleji. Vyraz nalehko, vezmi si vodu a vyhni se nejteplejší části dne."
      : "Může foukat nebo být chladněji. Přizpůsob oblečení a tempo.";
  }

  const content = (
    <section className={`run-weather-recommendation run-weather-${tone}`} aria-live="polite">
      <div className="run-weather-icon"><Icon size={27} /></div>
      <div className="run-weather-copy">
        <span className="run-weather-eyebrow"><ActivityIcon /> Doporučení pro {activityType === "chůze" ? "chůzi" : "běh"} · Dolní Lhota</span>
        <strong>{title}</strong>
        <p>{advice}</p>
        {current && <small>{Math.round(temperature)} °C · <span className="run-weather-wind"><Wind size={14} className="wind-icon-animated" /> vítr {Math.round(wind)} km/h</span>{rainChance > 0 ? ` · srážky ${Math.round(rainChance)} %` : ""}</small>}
        {linkToWeather && <span className="run-weather-more">Podrobná předpověď <span aria-hidden="true">→</span></span>}
      </div>
    </section>
  );
  return linkToWeather ? <Link href="/weather" className="run-weather-link" aria-label={`Otevřít počasí a doporučení pro ${activityType === "chůze" ? "chůzi" : "běh"}`}>{content}</Link> : content;
}
