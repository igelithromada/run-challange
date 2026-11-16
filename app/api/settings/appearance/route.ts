import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_THEMES = new Set(["default", "light", "dark", "auto", "weather", "custom"]);

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const selectedTheme = body.theme === "white" ? "light" : body.theme;
    const theme = typeof selectedTheme === "string" && SUPPORTED_THEMES.has(selectedTheme)
      ? selectedTheme
      : "default";
    const customColor = typeof body.customColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.customColor)
      ? body.customColor
      : "#36D1DC";
    const gradientEnabled = body.gradientEnabled !== false;

    await adminDb.collection("users").doc(decoded.uid).set({
      theme,
      customColor,
      gradientEnabled,
      themeUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, theme, customColor, gradientEnabled });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/appearance:", error);
    return NextResponse.json({ error: "Vzhled se nepodařilo uložit." }, { status: 500 });
  }
}
