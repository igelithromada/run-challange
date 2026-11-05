import { timingSafeEqual } from "node:crypto";
import { getAdminServices } from "@/lib/firebaseAdmin";

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

async function getConfiguredCode() {
  const { adminDb } = getAdminServices();
  const snapshot = await adminDb.collection("appConfig").doc("registration").get();
  const configured = snapshot.exists ? snapshot.data()?.code : undefined;
  if (typeof configured === "string" && configured.trim()) return configured.trim();

  const envCode = process.env.REGISTRATION_CODE?.trim();
  if (!envCode) return null;

  await adminDb.collection("appConfig").doc("registration").set({
    code: envCode,
    updatedAt: new Date(),
    source: "env",
  }, { merge: true });

  return envCode;
}

export async function POST(request: Request) {
  try {
    const expectedCode = await getConfiguredCode();

    if (!expectedCode) {
      return Response.json(
        { error: "Registrace není na serveru nakonfigurována." },
        { status: 503 }
      );
    }

    let submittedCode: unknown;
    try {
      const body = await request.json();
      submittedCode = body?.code;
    } catch {
      return Response.json({ error: "Neplatný požadavek." }, { status: 400 });
    }

    if (typeof submittedCode !== "string" || submittedCode.length > 128) {
      return Response.json({ valid: false }, { status: 400 });
    }

    const valid = safeEqual(submittedCode.trim(), expectedCode);
    return Response.json({ valid }, { status: valid ? 200 : 403 });
  } catch (error) {
    console.error("POST /api/registration-code:", error);
    return Response.json(
      { error: "Registrační kód se nepodařilo ověřit." },
      { status: 500 }
    );
  }
}
