import type { ActivityType } from "../types";
import type { WeatherPoint } from "./weather";

export function getActivityWeatherAdvice(current: WeatherPoint | undefined, type: ActivityType) {
  const temperature = typeof current?.temperature?.degrees === "number" && Number.isFinite(current.temperature.degrees) ? current.temperature.degrees : null;
  const condition = String(current?.weatherCondition?.type || "").toUpperCase();
  const wind = Math.max(0, Number(current?.wind?.speed?.value) || 0);
  const rainChance = Math.max(0, Math.min(100, Number(current?.precipitation?.probability?.percent) || 0));
  const activity = type === "chůze" ? "Chůze" : "Běh";
  const result = (tone: "good" | "caution" | "warning" | "neutral", title: string, advice: string) => ({ tone, title, advice, temperature, wind, rainChance });
  if (temperature === null || !condition) return result("neutral", "Počasí není dostupné", "Doporučení teď nelze vyhodnotit.");
  const storm = condition.includes("THUNDER");
  const snow = /SNOW|SLEET|HAIL/.test(condition);
  const rain = /RAIN|DRIZZLE/.test(condition);
  const ice = condition.includes("FREEZ") || (temperature <= 0 && snow);
  const hot = temperature >= (type === "chůze" ? 30 : 28);
  const strongWind = wind >= (type === "chůze" ? 45 : 40);
  if (storm || ice || (rain && rainChance >= 60) || strongWind || hot) {
    const advice = storm ? "Bouřka v okolí. Vyčkej na zlepšení počasí."
      : ice ? "Hrozí náledí. Zvaž odložení aktivity."
      : rain && rainChance >= 60 ? "Déšť může zhoršit povrch. Zvaž kratší trasu."
      : strongWind ? "Silný vítr. Vyhni se otevřeným úsekům."
      : "Je horko. Vyraz raději v chladnější části dne a vezmi si vodu.";
    return result("warning", `${activity} raději zvaž`, advice);
  }
  const fog = /FOG|HAZE/.test(condition);
  if (snow || rain || fog || rainChance >= 40 || temperature < 3 || temperature > 24 || wind >= 25) {
    const advice = snow ? "Sníh či kroupy mohou klouzat. Přizpůsob obuv a tempo."
      : rain || rainChance >= 40 ? "Počítej s deštěm a kluzkým povrchem."
      : fog ? "Horší viditelnost. Zvol známou trasu a reflexní prvky."
      : temperature < 3 ? "Je chladno. Vezmi si teplou vrstvu."
      : temperature > 24 ? "Je tepleji. Zvol volnější tempo a vezmi si vodu."
      : "Fouká vítr. Přizpůsob oblečení a trasu.";
    return result("caution", `${activity}: s opatrností`, advice);
  }
  return result("good", `${activity}: vhodné podmínky`, "Můžeš vyrazit. Tempo přizpůsob svému pocitu.");
}
