import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

type DynamicRoute = {
  id: string;
  disabled?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function distanceLabelFromGpx(text: string): string {
  const re = /<(?:trkpt|rtept)\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>/gi;
  const points: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon]);
  }
  if (points.length < 2) return "GPX";

  const toRad = (value: number) => value * Math.PI / 180;
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    meters += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  if (!(meters > 0)) return "GPX";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

async function resolveMissingDistance(route: DynamicRoute): Promise<DynamicRoute> {
  const distance = typeof route.distance === "string" ? route.distance.trim() : "";
  if (distance && distance !== "GPX" || typeof route.gpxUrl !== "string" || !route.gpxUrl) return route;

  try {
    const url = new URL(route.gpxUrl);
    if (!["res.cloudinary.com", "sarops.info"].includes(url.hostname)) return route;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return route;
      const text = await response.text();
      return { ...route, distance: distanceLabelFromGpx(text) };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return route;
  }
}


export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("recommendedRoutes").get();
    const dynamicRoutes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as DynamicRoute)
      .filter(route => route.disabled !== true && route.deleted !== true);
    const resolvedRoutes = await Promise.all(dynamicRoutes.map(resolveMissingDistance));
    return NextResponse.json({ routes: resolvedRoutes });
  } catch (error) {
    console.error("GET /api/routes/recommended:", error);
    return NextResponse.json({ routes: [] });
  }
}
