import type { WeatherResponse } from "./weather";

const WEATHER_CACHE_TTL = 5 * 60 * 1000;
let cached: { data: WeatherResponse; expiresAt: number } | null = null;
let pending: Promise<WeatherResponse> | null = null;

export async function getWeather(forceRefresh = false): Promise<WeatherResponse> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.data;
  if (!forceRefresh && pending) return pending;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/weather", {
        ...(forceRefresh ? { cache: "reload" as RequestCache } : {}),
        signal: controller.signal,
      });
      const data = await response.json() as WeatherResponse;
      cached = { data, expiresAt: Date.now() + WEATHER_CACHE_TTL };
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  if (!forceRefresh) pending = request;
  try {
    return await request;
  } finally {
    if (!forceRefresh && pending === request) pending = null;
  }
}
