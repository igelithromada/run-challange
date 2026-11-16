import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

import { gpxDistanceLabel } from "../../../lib/gpx";
import { fetchGpx } from "../../../lib/fetchGpx";

type DynamicRoute = {
  id: string;
  disabled?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveMissingDistance(route: DynamicRoute): Promise<DynamicRoute> {
  const distance = typeof route.distance === "string" ? route.distance.trim() : "";
  if (distance && distance !== "GPX" || typeof route.gpxUrl !== "string" || !route.gpxUrl) return route;

  try {
    const text=await fetchGpx(route.gpxUrl);
    return {...route,distance:gpxDistanceLabel(text)||"GPX"};
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
    return NextResponse.json({ error:"Trasy se nepodařilo načíst.", routes: [] },{status:500});
  }
}
