import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const keys = ["likes", "comments", "teams", "challenges", "chat"] as const;
export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const value = body?.socialNotifications;
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length || Object.entries(value).some(([key, item]) => !keys.includes(key as typeof keys[number]) || typeof item !== "boolean")) {
      return NextResponse.json({ error: "Neplatné nastavení upozornění." }, { status: 400 });
    }
    const ref = adminDb.collection("users").doc(decoded.uid);
    const socialNotifications = await adminDb.runTransaction(async tx => {
      const profile = await tx.get(ref);
      const previous = profile.data()?.socialNotifications || {};
      const next = Object.fromEntries(keys.map(key => [key, key in value ? value[key] : previous[key] !== false]));
      tx.set(ref, { socialNotifications: next }, { merge: true });
      return next;
    });
    return NextResponse.json({ ok: true, socialNotifications });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/social-notifications:", error);
    return NextResponse.json({ error: "Nastavení upozornění se nepodařilo uložit." }, { status: 500 });
  }
}
