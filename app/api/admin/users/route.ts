import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    const { decoded: adminUser, adminDb } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";

    if (!targetUid) {
      return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    }

    if (targetUid === adminUser.uid) {
      return NextResponse.json(
        { error: "Vlastní administrátorský účet zde nelze smazat." },
        { status: 400 }
      );
    }

    const runsSnapshot = await adminDb
      .collection("runs")
      .where("uid", "==", targetUid)
      .select(FieldPath.documentId())
      .get();

    for (let i = 0; i < runsSnapshot.docs.length; i += 450) {
      const batch = adminDb.batch();
      runsSnapshot.docs.slice(i, i + 450).forEach((run) => batch.delete(run.ref));
      await batch.commit();
    }

    await adminDb.collection("users").doc(targetUid).delete();
    const { adminAuth } = getAdminServices();
    await adminAuth.deleteUser(targetUid);

    return NextResponse.json({
      ok: true,
      deletedUid: targetUid,
      deletedRuns: runsSnapshot.size,
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

    console.error("DELETE /api/admin/users:", error);
    return NextResponse.json(
      { error: "Účet se nepodařilo smazat. Zkontroluj serverovou konfiguraci Firebase." },
      { status: 500 }
    );
  }
}
