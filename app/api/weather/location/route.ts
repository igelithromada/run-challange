import { weatherCoordinates, weatherLocationName } from "../../../lib/weatherLocation";
import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { adminDb } = await requireUser(request);
    const query = new URL(request.url).searchParams;
    const lat = Number(query.get("lat")), lon = Number(query.get("lon"));
    if (!query.get("lat") || !query.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: "Neplatná poloha." }, { status: 400 });
    const coords = weatherCoordinates(lat, lon);
    const latitude = coords.lat.toFixed(5), longitude = coords.lon.toFixed(5);
    const cacheRef = adminDb.collection("weatherLocations").doc(`v2_${latitude}_${longitude}`);
    const lease = adminDb.collection("serviceLimits").doc("weatherLocation");
    const cached = await cacheRef.get();
    if (cached.exists && cached.data()?.expiresAt > Date.now()) return NextResponse.json({ name: cached.data()?.name }, { headers: { "Cache-Control": "private, max-age=86400" } });
    // One shared lease for all server instances, not one limiter per user/device.
    const allowed = await adminDb.runTransaction(async transaction => {
      const current = await transaction.get(lease);
      if (Number(current.data()?.nextAt || 0) > Date.now()) return false;
      transaction.set(lease, { nextAt: Date.now() + 2000 }); return true;
    });
    if (!allowed) return NextResponse.json({ name: null }, { headers: { "Cache-Control": "no-store" } });
    const url = new URL(process.env.WEATHER_GEOCODER_URL || "https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({ lat: latitude, lon: longitude, format: "jsonv2", zoom: "16", addressdetails: "1", "accept-language": "cs" }).toString();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { headers: { "User-Agent": "DolniLhotaVPohybu/1.0 (https://run-challange.vercel.app)", "Accept-Language": "cs" }, signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Geocoder unavailable");
      const data = await response.json();
      const name = weatherLocationName(data.address || {});
      // Cache negative results too; never repeat a lookup on every weather refresh.
      await cacheRef.set({ name, expiresAt: Date.now() + 30 * 86400000 });
      return NextResponse.json({ name }, { headers: { "Cache-Control": "private, max-age=86400" } });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    return NextResponse.json({ name: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
