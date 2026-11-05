import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const { adminAuth, adminDb } = getAdminServices();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = header.slice("Bearer ".length).trim();
  const decoded = await adminAuth.verifyIdToken(token);
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profile.exists || profile.data()?.role !== "admin") throw new Error("FORBIDDEN");
  return adminDb;
}

export async function GET(request: Request) {
  try {
    const adminDb = await requireAdmin(request);
    const snapshot = await adminDb.collection("appConfig").doc("registration").get();
    const stored = snapshot.exists ? snapshot.data()?.code : undefined;
    const code = typeof stored === "string" && stored.trim()
      ? stored.trim()
      : process.env.REGISTRATION_CODE?.trim() || "";
    return NextResponse.json({ code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Nemáš oprávnění správce." : "Registrační kód se nepodařilo načíst." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const adminDb = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (code.length < 4 || code.length > 128) {
      return NextResponse.json({ error: "Registrační kód musí mít 4 až 128 znaků." }, { status: 400 });
    }

    await adminDb.collection("appConfig").doc("registration").set({
      code,
      updatedAt: new Date(),
      source: "admin",
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Nemáš oprávnění správce." : "Registrační kód se nepodařilo uložit." }, { status });
  }
}
