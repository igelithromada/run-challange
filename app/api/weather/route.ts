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
  if (!response.ok) {
    const detail = await response.text();
    console.error("Google Weather API error:", response.status, detail);
    throw new Error(`Google Weather API vrátilo chybu ${response.status}`);
  }
  return response.json();
}

export async function GET() {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { configured: false, error: "Chybí GOOGLE_WEATHER_API_KEY." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [current, hourly] = await Promise.all([
      googleWeather("currentConditions:lookup", apiKey),
      googleWeather("forecast/hours:lookup", apiKey),
    ]);

    return NextResponse.json(
      {
        configured: true,
        current,
        hourly: hourly.forecastHours || [],
        timeZone: hourly.timeZone || current.timeZone || { id: "Europe/Prague" },
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } }
    );
  } catch (error) {
    console.error("Načtení počasí selhalo:", error);
    return NextResponse.json(
      { configured: true, error: "Počasí Google se nyní nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
