import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { normalizeAppearance } from "../../../lib/appearance";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const { theme, customColor, gradientEnabled } = normalizeAppearance(body);

    const result = await adminDb.collection("users").doc(decoded.uid).set({
      theme,
      customColor,
      gradientEnabled,
      themeUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, theme, customColor, gradientEnabled, savedAt: result.writeTime.toMillis() });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/appearance:", error);
    return NextResponse.json({ error: "Vzhled se nepodařilo uložit." }, { status: 500 });
  }
}
