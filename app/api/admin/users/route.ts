import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  const decoded = await adminAuth.verifyIdToken(idToken);
  const adminProfile = await adminDb.collection("users").doc(decoded.uid).get();

  if (!adminProfile.exists || adminProfile.data()?.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return decoded.uid;
}

export async function DELETE(request: NextRequest) {
  try {
    const requestingUid = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const targetUid = typeof body?.uid === "string" ? body.uid.trim() : "";

    if (!targetUid) {
      return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    }

    if (targetUid === requestingUid) {
      return NextResponse.json(
        { error: "Vlastní administrátorský účet zde nelze smazat." },
        { status: 400 }
      );
    }

    // Nejdřív odstraníme data aktivit, aby po odstranění účtu nezůstala
    // ve Firestore osiřelá data.
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
    await adminAuth.deleteUser(targetUid);

    return NextResponse.json({
      ok: true,
      deletedUid: targetUid,
      deletedRuns: runsSnapshot.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba.";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Neautorizovaný požadavek." }, { status: 401 });
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Nemáš oprávnění správce." }, { status: 403 });
    }

    console.error("DELETE /api/admin/users:", error);
    return NextResponse.json(
      { error: "Účet se nepodařilo smazat. Zkontroluj serverovou konfiguraci Firebase." },
      { status: 500 }
    );
  }
}
