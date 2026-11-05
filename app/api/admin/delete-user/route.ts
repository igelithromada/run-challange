import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAdmin(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  if (decoded.admin === true) return decoded;

  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (profile.exists && profile.data()?.role === "admin") return decoded;
  return null;
}

async function deleteUserRuns(uid: string) {
  const snapshot = await adminDb.collection("runs").where("uid", "==", uid).get();
  const refs = snapshot.docs.map((item) => item.ref);

  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    if (refs.length) await batch.commit();
  }

  return refs.length;
}

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Nemáš oprávnění k této operaci." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    if (!uid) {
      return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    }
    if (uid === admin.uid) {
      return NextResponse.json({ error: "Vlastní administrátorský účet zde nelze smazat." }, { status: 400 });
    }

    const target = await adminAuth.getUser(uid);
    const deletedRuns = await deleteUserRuns(uid);

    await adminDb.collection("users").doc(uid).delete();
    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      uid,
      email: target.email || "",
      deletedRuns,
    });
  } catch (error: any) {
    console.error("Admin delete user failed:", error);
    const status =
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/id-token-revoked" ||
      error?.code === "auth/argument-error"
        ? 401
        : error?.code === "auth/user-not-found"
          ? 404
          : 500;

    return NextResponse.json(
      { error: status === 500 ? "Účet se nepodařilo úplně odstranit." : "Požadavek se nepodařilo ověřit nebo uživatel neexistuje." },
      { status }
    );
  }
}
