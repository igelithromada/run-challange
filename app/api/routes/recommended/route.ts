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

export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("recommendedRoutes").get();
    const dynamicRoutes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as DynamicRoute)
      .filter(route => route.disabled !== true && route.deleted !== true);
    return NextResponse.json({ routes: dynamicRoutes });
  } catch (error) {
    console.error("GET /api/routes/recommended:", error);
    return NextResponse.json({ routes: [] });
  }
}
