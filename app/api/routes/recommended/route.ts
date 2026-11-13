import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { routeGroups } from "../../../lib/routes";

type DynamicRoute = {
  id: string;
  disabled?: boolean;
  deleted?: boolean;
  [key: string]: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("recommendedRoutes").get();
    const dynamicRoutes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as DynamicRoute)
      .filter(route => route.disabled !== true && route.deleted !== true);
    const overrideSnapshot = await adminDb.collection("recommendedRouteOverrides").get();
    const overrides = new Map(overrideSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const staticRoutes = routeGroups.flatMap(group => group.routes.map(route => {
      const id = "static:" + group.id + ":" + encodeURIComponent(route.name);
      const override = overrides.get(id) || {};
      if (override.disabled === true || override.deleted === true) return null;
      return {
        id,
        name: typeof override.name === "string" ? override.name : route.name,
        distance: route.distance,
        activity: "běh i chůze",
        description: typeof override.description === "string" ? override.description : route.description,
        badge: typeof override.badge === "string" ? override.badge : (route.badge || ""),
        mapUrl: typeof override.mapUrl === "string" ? override.mapUrl : route.mapUrl,
        gpxUrl: typeof override.gpxUrl === "string" ? override.gpxUrl : (route.gpxUrl || ""),
        groupId: group.id,
        groupTitle: group.title,
        groupSubtitle: group.subtitle,
        sourceUrl: typeof override.sourceUrl === "string" ? override.sourceUrl : group.sourceUrl,
      };
    }).filter(Boolean));
    return NextResponse.json({ routes: [...dynamicRoutes, ...staticRoutes] });
  } catch (error) {
    console.error("GET /api/routes/recommended:", error);
    return NextResponse.json({ routes: [] });
  }
}
