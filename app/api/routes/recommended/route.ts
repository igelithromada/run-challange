import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection("recommendedRoutes").get();
    return NextResponse.json({ routes: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    console.error("GET /api/routes/recommended:", error);
    return NextResponse.json({ routes: [] });
  }
}
