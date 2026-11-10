import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verify(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const { adminAuth } = getAdminServices();
  return adminAuth.verifyIdToken(header.slice(7).trim());
}

export async function POST(request: Request) {
  try {
    const decoded = await verify(request);
    const body = await request.json().catch(() => ({}));
    const subscription = body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Neplatné předplatné notifikací." }, { status: 400 });
    }
    const { adminDb } = getAdminServices();
    const id = createHash("sha256").update(String(subscription.endpoint)).digest("hex").slice(0, 64);
    await adminDb.collection("users").doc(decoded.uid).collection("pushSubscriptions").doc(id).set({
      ...subscription,
      updatedAt: new Date(),
      userAgent: request.headers.get("user-agent") || ""
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/notifications/subscribe:", error);
    return NextResponse.json({ error: "Notifikace se nepodařilo zapnout." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded = await verify(request);
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || "");
    if (!endpoint) return NextResponse.json({ error: "Chybí identifikátor notifikace." }, { status: 400 });
    const { adminDb } = getAdminServices();
    const id = createHash("sha256").update(endpoint).digest("hex").slice(0, 64);
    await adminDb.collection("users").doc(decoded.uid).collection("pushSubscriptions").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/notifications/subscribe:", error);
    return NextResponse.json({ error: "Notifikaci se nepodařilo vypnout." }, { status: 500 });
  }
}
