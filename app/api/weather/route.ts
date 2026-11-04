import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const LATITUDE = 49.84;
const LONGITUDE = 18.10;

async function googleWeather(path: string, apiKey: string) {
  const url = new URL(`https://weather.googleapis.com/v1/${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("location.latitude", String(LATITUDE));
  url.searchParams.set("location.longitude", String(LONGITUDE));
  url.searchParams.set("unitsSystem", "METRIC");
  url.searchParams.set("languageCode", "cs-CZ");
  if (path.startsWith("forecast/hours")) {
    url.searchParams.set("hours", "12");
    url.searchParams.set("pageSize", "12");
  }
  const response = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Google Weather API ${response.status}: ${await response.text()}`);
  return response.json();
}

function description(code: number) {
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
  if (code >= 71 && code <= 86) return "SNOW";
  if (code >= 51 && code <= 67) return "RAIN";
  if (code >= 45 && code <= 48) return "FOG";
  if (code >= 1 && code <= 2) return "PARTLY_CLOUDY";
  if (code === 3) return "CLOUDY";
  return "CLEAR";
}

async function openMeteoFallback() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LATITUDE));
  url.searchParams.set("longitude", String(LONGITUDE));
  url.searchParams.set("timezone", "Europe/Prague");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,wind_speed_10m");
  url.searchParams.set("wind_speed_unit", "kmh");
  const response = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`Open-Meteo API ${response.status}`);
  const data = await response.json();
  const c = data.current;
  const h = data.hourly;
  const start = Math.max(0, h.time.findIndex((time: string) => time >= c.time));
  return {
    configured: true,
    source: "Open-Meteo",
    current: {
      temperature: { degrees: c.temperature_2m },
      feelsLikeTemperature: { degrees: c.apparent_temperature },
      weatherCondition: { type: conditionType(c.weather_code), description: { text: description(c.weather_code) } },
      wind: { speed: { value: c.wind_speed_10m, unit: "KILOMETERS_PER_HOUR" } },
      precipitation: { probability: { percent: h.precipitation_probability[start] ?? null } },
      relativeHumidity: c.relative_humidity_2m
    },
    hourly: h.time.slice(start, start + 12).map((time: string, offset: number) => {
      const i = start + offset;
      return {
        interval: { startTime: new Date(time).toISOString() },
        temperature: { degrees: h.temperature_2m[i] },
        weatherCondition: { type: conditionType(h.weather_code[i]) },
        precipitation: { probability: { percent: h.precipitation_probability[i] ?? 0 } }
      };
    }),
    timeZone: { id: "Europe/Prague" },
    fetchedAt: new Date().toISOString()
  };
}

export async function GET() {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (apiKey) {
    try {
      const [current, hourly] = await Promise.all([
        googleWeather("currentConditions:lookup", apiKey),
        googleWeather("forecast/hours:lookup", apiKey)
      ]);
      return NextResponse.json({
        configured: true, source: "Google Weather", current,
        hourly: hourly.forecastHours || [],
        timeZone: hourly.timeZone || current.timeZone || { id: "Europe/Prague" },
        fetchedAt: new Date().toISOString()
      }, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } });
    } catch (error) {
      console.error("Google Weather selhalo, přepínám na Open-Meteo:", error);
    }
  }
  try {
    return NextResponse.json(await openMeteoFallback(), {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" }
    });
  } catch (error) {
    console.error("Načtení počasí selhalo:", error);
    return NextResponse.json({ configured: true, error: "Předpověď počasí se nyní nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
