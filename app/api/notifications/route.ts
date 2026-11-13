import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser as requireApiUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { adminDb, decoded } = await requireApiUser(request);
    const snapshot = await adminDb.collection("notifications")
      .where("recipientUid", "==", decoded.uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type || "social",
        title: data.title || "Nové upozornění",
        body: data.body || "",
        runId: data.runId || "",
        actorUid: data.actorUid || "",
        actorNickname: data.actorNickname || "Uživatel",
        actorAvatarUrl: data.actorAvatarUrl || "",
        read: data.read === true,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter(item => !item.read).length,
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("GET /api/notifications:", error);
    return NextResponse.json({ error: "Upozornění se nepodařilo načíst." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminDb, decoded } = await requireApiUser(request);
    const body = await request.json().catch(() => ({}));
    const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
    const markAll = body?.markAll === true;

    if (markAll) {
      const snapshot = await adminDb.collection("notifications")
        .where("recipientUid", "==", decoded.uid)
        .where("read", "==", false)
        .limit(100)
        .get();
      const batch = adminDb.batch();
      snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (!notificationId) return NextResponse.json({ error: "Chybí ID upozornění." }, { status: 400 });
    const ref = adminDb.collection("notifications").doc(notificationId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.recipientUid !== decoded.uid) {
      return NextResponse.json({ error: "Upozornění neexistuje." }, { status: 404 });
    }

    await ref.update({ read: true, readAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/notifications:", error);
    return NextResponse.json({ error: "Upozornění se nepodařilo označit." }, { status: 500 });
  }
}
