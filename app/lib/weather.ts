export type WeatherCondition = {
  type?: string;
  description?: { text?: string };
};

export type Precipitation = {
  probability?: { percent?: number | null };
  amount?: number | null;
};

export type WeatherPoint = {
  isDay?: boolean;
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  wind?: { speed?: { value?: number; unit?: string } };
  precipitation?: Precipitation;
  relativeHumidity?: number;
};

export type WeatherHour = {
  interval?: { startTime?: string; endTime?: string };
  isDay?: boolean;
  displayDateTime?: { hours?: number };
  temperature?: { degrees?: number };
  weatherCondition?: WeatherCondition;
  precipitation?: Precipitation;
};

export type WeatherResponse = {
  configured: boolean;
  source?: string;
  current?: WeatherPoint;
  hourly?: WeatherHour[];
  timeZone?: { id?: string };
  fetchedAt?: string;
  observedAt?: string;
  error?: string;
};

/** Use absolute instants so midnight, DST and a different device zone work alike. */
export function upcomingWeatherHours(hours: WeatherHour[] = [], now = Date.now(), limit = 12) {
  return hours.filter(item => {
    const start = Date.parse(item.interval?.startTime || "");
    const end = Date.parse(item.interval?.endTime || "") || start + 3600000;
    return Number.isFinite(start) && end > now;
  }).sort((a, b) => Date.parse(a.interval!.startTime!) - Date.parse(b.interval!.startTime!)).slice(0, limit);
}

export function formatPrecipitation(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  if (value > 0 && value < 0.1) return "< 0,1 mm";
  return `${value.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;
}

export function weatherTime(value?: string, timeZone = "Europe/Prague") {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone });
}

export function weatherIsNight(item: { isDay?: boolean }, instant: string | number, timeZone = "Europe/Prague") {
  if (typeof item.isDay === "boolean") return !item.isDay;
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return false;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(date));
  return hour < 6 || hour >= 20;
}
