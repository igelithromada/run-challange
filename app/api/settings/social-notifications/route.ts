import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const value = body?.socialNotifications;
    if (!value || typeof value !== "object") return NextResponse.json({ error: "Neplatné nastavení upozornění." }, { status: 400 });
    const socialNotifications = { likes: value.likes !== false, comments: value.comments !== false };
    await adminDb.collection("users").doc(decoded.uid).set({ socialNotifications }, { merge: true });
    return NextResponse.json({ ok: true, socialNotifications });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/social-notifications:", error);
    return NextResponse.json({ error: "Nastavení upozornění se nepodařilo uložit." }, { status: 500 });
  }
}