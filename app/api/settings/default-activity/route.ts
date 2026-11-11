import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const defaultActivity = body?.defaultActivity === "chůze" ? "chůze" : body?.defaultActivity === "běh" ? "běh" : null;

    if (!defaultActivity) {
      return NextResponse.json({ error: "Neplatná výchozí aktivita." }, { status: 400 });
    }

    await adminDb.collection("users").doc(decoded.uid).set({ defaultActivity }, { merge: true });
    await adminDb.collection("publicProfiles").doc(decoded.uid).set({ activityType: defaultActivity }, { merge: true });
    return NextResponse.json({ ok: true, defaultActivity });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/default-activity:", error);
    return NextResponse.json({ error: "Výchozí aktivitu se nepodařilo uložit." }, { status: 500 });
  }
}
