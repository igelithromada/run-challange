import { NextResponse } from "next/server";
import { requireUser as requireApiUser, authErrorResponse } from "../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { adminDb, decoded } = await requireApiUser(request);
    const inbox = adminDb.collection("notifications").where("recipientUid", "==", decoded.uid);
    if (new URL(request.url).searchParams.get("view") === "count") {
      // Legacy notifications without a read field are unread as well.
      let unreadCount: number;
      try {
        const [total, read] = await Promise.all([inbox.count().get(), inbox.where("read", "==", true).count().get()]);
        unreadCount = Math.max(0, total.data().count - read.data().count);
      } catch (error) {
        // Older Firestore deployments may still lack an index for the combined filters.
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== 9) throw error;
        const snapshot = await inbox.select("read").get();
        unreadCount = snapshot.docs.filter(doc => doc.get("read") !== true).length;
      }
      return NextResponse.json({ unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const snapshot = await inbox.get();

    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type || "social",
        title: data.title || "Nové upozornění",
        body: data.body || "",
        runId: data.runId || "",
        teamId: data.teamId || "",
        challengeId: data.challengeId || "",
        actorUid: data.actorUid || "",
        actorNickname: data.actorNickname || "Uživatel",
        actorAvatarUrl: data.actorAvatarUrl || "",
        read: data.read === true,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    notifications.sort((a, b) => Number(a.read) - Number(b.read) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return NextResponse.json({
      notifications: notifications.slice(0, 50),
      unreadCount: notifications.filter(item => !item.read).length,
    }, { headers: { "Cache-Control": "private, no-store" } });
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
        .get();
      const unread = snapshot.docs;
      for(let start=0;start<unread.length;start+=450){
        const batch=adminDb.batch();
        unread.slice(start,start+450).forEach(doc=>batch.delete(doc.ref));
        await batch.commit();
      }
      return NextResponse.json({ ok: true });
    }

    if (!notificationId || notificationId.includes("/")) return NextResponse.json({ error: "Chybí ID upozornění." }, { status: 400 });
    const ref = adminDb.collection("notifications").doc(notificationId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.recipientUid !== decoded.uid) {
      return NextResponse.json({ error: "Upozornění neexistuje." }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/notifications:", error);
    return NextResponse.json({ error: "Upozornění se nepodařilo označit." }, { status: 500 });
  }
}
