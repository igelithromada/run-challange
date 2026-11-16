import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminServices } from "../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

async function getConfiguredCode(adminDb: ReturnType<typeof getAdminServices>["adminDb"]) {
  const snapshot = await adminDb.collection("appConfig").doc("registration").get();
  const stored = snapshot.exists ? snapshot.data()?.code : undefined;
  if (typeof stored === "string" && stored.trim()) return stored.trim();
  return process.env.REGISTRATION_CODE?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!email || email.length > 254 || !email.includes("@") || password.length < 6 || password.length > 128 || code.length < 4 || code.length > 128) {
      return NextResponse.json({ error: "Zkontroluj email, heslo a registrační kód." }, { status: 400 });
    }

    const expectedCode = await getConfiguredCode(adminDb);
    if (!expectedCode) {
      return NextResponse.json({ error: "Registrace není na serveru nakonfigurována." }, { status: 503 });
    }
    if (!safeEqual(code, expectedCode)) {
      return NextResponse.json({ error: "Neplatný registrační kód." }, { status: 403 });
    }

    const user = await adminAuth.createUser({ email, password });
    const customToken = await adminAuth.createCustomToken(user.uid);
    return NextResponse.json({ ok: true, customToken });
  } catch (error) {
    console.error("POST /api/register:", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code || "") : "";
    if (code.includes("email-already-exists")) {
      return NextResponse.json({ error: "Registrace se nepodařila. Email už může být použitý." }, { status: 400 });
    }
    return NextResponse.json({ error: "Registrace se nepodařila. Zkus to prosím znovu." }, { status: 500 });
  }
}
