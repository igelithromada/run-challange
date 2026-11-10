import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nejsi přihlášen." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(header.slice("Bearer ".length).trim());
    const body = await request.json().catch(() => ({}));
    const defaultActivity = body?.defaultActivity === "chůze" ? "chůze" : body?.defaultActivity === "běh" ? "běh" : null;

    if (!defaultActivity) {
      return NextResponse.json({ error: "Neplatná výchozí aktivita." }, { status: 400 });
    }

    await adminDb.collection("users").doc(decoded.uid).set({ defaultActivity }, { merge: true });
    return NextResponse.json({ ok: true, defaultActivity });
  } catch (error) {
    console.error("POST /api/settings/default-activity:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message.includes("verify") || message.includes("token") ? "Přihlášení vypršelo. Přihlas se znovu." : "Výchozí aktivitu se nepodařilo uložit." },
      { status: 500 }
    );
  }
}
