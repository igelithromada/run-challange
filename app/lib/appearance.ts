export const THEME_CACHE_KEY = "dolni-lhota-theme-v1";
export const DEFAULT_COLOR = "#36D1DC";
export const THEMES = ["default", "light", "dark", "auto", "weather", "custom"] as const;
export type Theme = typeof THEMES[number];

export type Appearance = { theme: Theme; customColor: string; gradientEnabled: boolean };
export const DEFAULT_APPEARANCE: Appearance = { theme: "default", customColor: DEFAULT_COLOR, gradientEnabled: true };

export function normalizeAppearance(value?: { theme?: unknown; customColor?: unknown; gradientEnabled?: unknown } | null): Appearance {
  const theme = value?.theme === "white" ? "light" : value?.theme;
  return {
    theme: THEMES.find(option => option === theme) ?? "default",
    customColor: typeof value?.customColor === "string" && /^#[0-9a-f]{6}$/i.test(value.customColor) ? value.customColor : DEFAULT_COLOR,
    gradientEnabled: value?.gradientEnabled !== false,
  };
}

export const TIME_PERIODS = [
  [5, "noc"], [7, "svitani"], [10, "rano"], [13, "dopoledne"],
  [16, "odpoledne"], [19, "zapad"], [22, "soumrak"], [24, "noc"],
] as const;

export function timePeriod(hour: number) {
  return TIME_PERIODS.find(([end]) => hour < end)?.[1] ?? "noc";
}

export function weatherPalette(current: {
  isDay?: boolean;
  weatherCondition?: { type?: string };
  wind?: { speed?: { value?: number } };
}, hour: number) {
  const type = current.weatherCondition?.type?.toUpperCase();
  if (!type) return null;
  const night = current.isDay === false || (current.isDay === undefined && (hour < 6 || hour >= 20));
  if (type.includes("THUNDER")) return "storm";
  if (/SNOW|SLEET|HAIL/.test(type)) return night ? "snow-night" : "snow";
  if (/RAIN|DRIZZLE/.test(type)) return night ? "rain-night" : "rain";
  if (type.includes("FOG")) return "fog";
  if ((current.wind?.speed?.value ?? 0) >= 29) return "wind";
  if (type.includes("CLOUD")) return night ? "cloudy-night" : "cloudy";
  return night ? "night" : "clear";
}
