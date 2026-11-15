import { NextResponse } from "next/server";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { deleteUserData } from "../../../lib/deleteUserData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded: admin, adminDb } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    if (!uid) return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    if (uid === admin.uid) return NextResponse.json({ error: "Vlastní administrátorský účet zde nelze smazat." }, { status: 400 });

    const { adminAuth } = getAdminServices();
    const target = await adminAuth.getUser(uid);
    const deleted = await deleteUserData(adminDb, uid);
    await adminAuth.deleteUser(uid);
    return NextResponse.json({ ok: true, uid, email: target.email || "", ...deleted });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

    console.error("Admin delete user failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CLOUDINARY_DELETE_FAILED:")) {
      return NextResponse.json({ error: "Účet nebyl smazán, protože se nepodařilo bezpečně odstranit všechny fotografie z Cloudinary. Zkontroluj Cloudinary API klíč a oprávnění." }, { status: 502 });
    }
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
    const status = code === "auth/id-token-expired" || code === "auth/id-token-revoked" || code === "auth/argument-error" ? 401 : code === "auth/user-not-found" ? 404 : 500;
    return NextResponse.json({ error: status === 500 ? "Účet se nepodařilo úplně odstranit." : "Požadavek se nepodařilo ověřit nebo uživatel neexistuje." }, { status });
  }
}
