import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const LATITUDE = 49.84;
const LONGITUDE = 18.10;

async function fetchWithTimeout(url: string, timeoutMs = 8000, fresh = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(fresh ? { cache: "no-store" as RequestCache } : { next: { revalidate: 900 } }), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function description(code: number, precipitationMm?: number | null) {
  const rainCodes = code >= 51 && code <= 67 || code >= 80 && code <= 82;
  if (rainCodes && precipitationMm !== null && precipitationMm !== undefined) {
    if (precipitationMm >= 7.5) return "Silný déšť";
    if (precipitationMm >= 2.5) return "Střední déšť";
    if (precipitationMm > 0) return "Slabý déšť";
  }

  const labels: Record<number, string> = {
    0:"Jasno",1:"Převážně jasno",2:"Polojasno",3:"Zataženo",45:"Mlha",48:"Mrznoucí mlha",
    51:"Slabé mrholení",53:"Mrholení",55:"Silné mrholení",56:"Mrznoucí mrholení",57:"Silné mrznoucí mrholení",
    61:"Slabý déšť",63:"Déšť",65:"Silný déšť",66:"Mrznoucí déšť",67:"Silný mrznoucí déšť",
    71:"Slabé sněžení",73:"Sněžení",75:"Silné sněžení",77:"Sněhová zrna",80:"Přeháňky",81:"Přeháňky",
    82:"Silné přeháňky",85:"Sněhové přeháňky",86:"Silné sněhové přeháňky",95:"Bouřka",96:"Bouřka s kroupami",99:"Silná bouřka s kroupami"
  };
  return labels[code] || "Proměnlivé počasí";
}

function conditionType(code: number) {
  if (code >= 95) return "THUNDERSTORM";
  if ((code >= 71 && code <= 77 || code >= 85 && code <= 86)) return "SNOW";
  if ((code >= 51 && code <= 67 || code >= 80 && code <= 82)) return "RAIN";
  if (code >= 45 && code <= 48) return "FOG";
  if (code === 2) return "PARTLY_CLOUDY";
  if (code === 3) return "CLOUDY";
  return "CLEAR";
}

async function openMeteo(fresh = false) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LATITUDE));
  url.searchParams.set("longitude", String(LONGITUDE));
  url.searchParams.set("timezone", "Europe/Prague");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m"
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,is_day"
  );
  url.searchParams.set("wind_speed_unit", "kmh");

  const response = await fetchWithTimeout(url.toString(), 8000, fresh);
  if (!response.ok) throw new Error(`Open-Meteo API ${response.status}`);

  const data = await response.json();
  const c = data.current;
  const h = data.hourly;
  if (!c || !h || !Array.isArray(h.time)) throw new Error("Neplatná data počasí");
  const now = Date.now();
  const hourStart = Math.floor(now / 3600000) * 3600;
  const start = h.time.findIndex((time: number) => time >= hourStart);
  if (start < 0) throw new Error("Předpověď neobsahuje aktuální hodiny");
  const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    configured: true,
    source: "Open-Meteo",
    current: {
      isDay: c.is_day === 1 ? true : c.is_day === 0 ? false : undefined,
      temperature: { degrees: c.temperature_2m },
      feelsLikeTemperature: { degrees: c.apparent_temperature },
      weatherCondition: {
        type: conditionType(c.weather_code),
        description: { text: description(c.weather_code, c.precipitation) }
      },
      wind: { speed: { value: c.wind_speed_10m, unit: "KILOMETERS_PER_HOUR" } },
      precipitation: {
        probability: { percent: numberOrNull(h.precipitation_probability?.[start + 1]) },
        amount: c.precipitation ?? null
      },
      relativeHumidity: c.relative_humidity_2m
    },
    hourly: h.time.slice(start, start + 24).map((time: number, offset: number) => {
      const i = start + offset;
      // Open-Meteo's precipitation and weather code describe the preceding hour.
      // The 08:00 accumulation therefore belongs to the visible 07:00–08:00 slot.
      const endIndex = i + 1;
      return {
        interval: { startTime: new Date(time * 1000).toISOString(), endTime: new Date((time + 3600) * 1000).toISOString() },
        isDay: h.is_day?.[i] === 1 ? true : h.is_day?.[i] === 0 ? false : undefined,
        temperature: { degrees: h.temperature_2m[i] },
        weatherCondition: {
          type: typeof h.weather_code?.[endIndex] === "number" ? conditionType(h.weather_code[endIndex]) : "UNKNOWN",
          description: { text: description(h.weather_code?.[endIndex], h.precipitation?.[endIndex]) }
        },
        precipitation: {
          probability: { percent: numberOrNull(h.precipitation_probability?.[endIndex]) },
          amount: numberOrNull(h.precipitation?.[endIndex])
        }
      };
    }),
    timeZone: { id: "Europe/Prague" },
    fetchedAt: new Date(now).toISOString(),
    observedAt: typeof c.time === "number" ? new Date(c.time * 1000).toISOString() : undefined
  };
}

export async function GET(request?: Request) {
  const fresh = request ? new URL(request.url).searchParams.get("refresh") === "1" : false;
  try {
    return NextResponse.json(await openMeteo(fresh), {
      headers: { "Cache-Control": fresh ? "no-store" : "public, max-age=0, s-maxage=900, must-revalidate" }
    });
  } catch (error) {
    console.error("Načtení počasí z Open-Meteo selhalo:", error);
    return NextResponse.json(
      { configured: true, source: "Open-Meteo", error: "Předpověď počasí se nyní nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
