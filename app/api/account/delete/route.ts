import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { deleteUserData } from "../../../lib/deleteUserData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request, {allowBlocked:true});
    const { adminAuth } = getAdminServices();
    const target = await adminAuth.getUser(decoded.uid);
    const deleted = await deleteUserData(adminDb, decoded.uid);
    await adminAuth.deleteUser(decoded.uid);
    return NextResponse.json({ ok: true, email: target.email || "", ...deleted });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("Self delete user failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CLOUDINARY_DELETE_FAILED:")) {
      return NextResponse.json({ error: "Účet nebyl smazán, protože se nepodařilo bezpečně odstranit všechny fotografie. Zkus to prosím později." }, { status: 502 });
    }
    return NextResponse.json({ error: "Účet se nepodařilo úplně odstranit. Část dat už mohla být odstraněna; zkus dokončení znovu." }, { status: 500 });
  }
}
