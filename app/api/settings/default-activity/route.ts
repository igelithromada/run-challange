import { isActivityType } from "../../../lib/validation";
import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const defaultActivity = isActivityType(body?.defaultActivity) ? body.defaultActivity : null;

    if (!defaultActivity) {
      return NextResponse.json({ error: "Neplatná výchozí aktivita." }, { status: 400 });
    }

    const batch=adminDb.batch();
    batch.set(adminDb.collection("users").doc(decoded.uid),{defaultActivity},{merge:true});
    batch.set(adminDb.collection("publicProfiles").doc(decoded.uid),{activityType:defaultActivity},{merge:true});
    await batch.commit();
    return NextResponse.json({ ok: true, defaultActivity });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/default-activity:", error);
    return NextResponse.json({ error: "Výchozí aktivitu se nepodařilo uložit." }, { status: 500 });
  }
}
