import { timingSafeEqual } from "node:crypto";
import { getAdminServices } from "@/lib/firebaseAdmin";
import { consumeRateLimit } from "@/lib/rateLimit";

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

  // Veřejné ověření registračního kódu nesmí zapisovat tajný kód do Firestore.
  // Pokud administrátor ještě nenastavil hodnotu v appConfig, použije se pouze
  // serverová proměnná prostředí.
  return envCode;
}

export async function POST(request: Request) {
  try {
    const { adminDb } = getAdminServices();
    const rate = await consumeRateLimit(adminDb, request, "registration-code", 10);
    if (!rate.allowed) return Response.json({ error: "Příliš mnoho pokusů. Zkus to později." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

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
