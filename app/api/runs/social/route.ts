import { NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser(request: Request) {
  const { adminAuth, adminDb } = getAdminServices();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = header.slice("Bearer ".length).trim();
  const decoded = await adminAuth.verifyIdToken(token);
  return { ...getAdminServices(), decoded };
}

export async function GET(request: Request) {
  try {
    const { adminDb, decoded } = await requireUser(request);
    const runId = new URL(request.url).searchParams.get("runId")?.trim();
    if (!runId) return NextResponse.json({ error: "Chybí ID záznamu." }, { status: 400 });

    const run = await adminDb.collection("runs").doc(runId).get();
    if (!run.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });
    const data = run.data() || {};
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy.filter((id): id is string => typeof id === "string") : [];

    const commentsSnapshot = await adminDb
      .collection("runs").doc(runId).collection("comments")
      .orderBy("createdAt", "asc")
      .get();

    const comments = commentsSnapshot.docs.map(comment => {
      const item = comment.data();
      return {
        id: comment.id,
        uid: item.uid || "",
        nickname: item.nickname || "Uživatel",
        avatarUrl: item.avatarUrl || "",
        text: item.text || "",
        createdAt: item.createdAt?.toDate?.()?.toISOString?.() || null,
        mine: item.uid === decoded.uid,
      };
    });

    const uniqueLikeIds = [...new Set(likedBy)];
    const likeUsers: Array<{ uid: string; nickname: string; avatarUrl: string }> = [];
    for (let i = 0; i < uniqueLikeIds.length; i += 30) {
      const chunk = uniqueLikeIds.slice(i, i + 30);
      if (!chunk.length) continue;
      const snapshots = await adminDb.collection("publicProfiles").where(FieldPath.documentId(), "in", chunk).get();
      snapshots.docs.forEach(profile => {
        const item = profile.data();
        likeUsers.push({
          uid: profile.id,
          nickname: item.nickname || "Uživatel",
          avatarUrl: item.avatarUrl || "",
        });
      });
    }

    const currentProfile = await adminDb.collection("users").doc(decoded.uid).get();
    const currentProfileData = currentProfile.exists ? currentProfile.data() || {} : {};
    return NextResponse.json({
      liked: likedBy.includes(decoded.uid),
      likeCount: Number(data.likeCount) || likedBy.length,
      commentCount: Number(data.commentCount) || comments.length,
      likes: likeUsers,
      comments,
      isAdmin: decoded.admin === true || currentProfileData.role === "admin",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Nejsi přihlášen." : "Sociální data se nepodařilo načíst." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { adminDb, decoded } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const runId = typeof body?.runId === "string" ? body.runId.trim() : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!runId || !["like", "comment", "comment_update", "comment_delete"].includes(action)) {
      return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
    }

    const runRef = adminDb.collection("runs").doc(runId);

    if (action === "comment_update" || action === "comment_delete") {
      const commentId = typeof body?.commentId === "string" ? body.commentId.trim() : "";
      if (!commentId) return NextResponse.json({ error: "Chybí ID komentáře." }, { status: 400 });
      const commentRef = runRef.collection("comments").doc(commentId);
      const commentSnapshot = await commentRef.get();
      if (!commentSnapshot.exists) return NextResponse.json({ error: "Komentář neexistuje." }, { status: 404 });
      const commentData = commentSnapshot.data() || {};
      const profile = await adminDb.collection("users").doc(decoded.uid).get();
      const profileData = profile.exists ? profile.data() || {} : {};
      const isAdmin = decoded.admin === true || profileData.role === "admin";
      if (commentData.uid !== decoded.uid && !isAdmin) {
        return NextResponse.json({ error: "K tomuto komentáři nemáš oprávnění." }, { status: 403 });
      }

      if (action === "comment_update") {
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 500) return NextResponse.json({ error: "Komentář musí mít 1 až 500 znaků." }, { status: 400 });
        await commentRef.update({ text, updatedAt: FieldValue.serverTimestamp() });
        return NextResponse.json({ ok: true, comment: { id: commentId, text } });
      }

      await adminDb.runTransaction(async transaction => {
        const currentRun = await transaction.get(runRef);
        const currentCount = Number(currentRun.data()?.commentCount) || 0;
        transaction.delete(commentRef);
        transaction.update(runRef, { commentCount: Math.max(0, currentCount - 1) });
      });
      return NextResponse.json({ ok: true });
    }
    const runSnapshot = await runRef.get();
    if (!runSnapshot.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });

    const runData = runSnapshot.data() || {};

    // Vlastní záznam lze komentovat (např. doplnění informací nebo reakce na diskusi).
    // Lajknutí vlastního záznamu zůstává zablokované.
    if (action === "like" && runData.uid === decoded.uid) {
      return NextResponse.json(
        { error: "Vlastní záznam nelze lajknout." },
        { status: 403 }
      );
    }

    if (action === "like") {
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(runRef);
        const data = snapshot.data() || {};
        const current = Array.isArray(data.likedBy) ? data.likedBy.filter((id): id is string => typeof id === "string") : [];
        const liked = current.includes(decoded.uid);
        const next = liked ? current.filter(id => id !== decoded.uid) : [...current, decoded.uid];
        transaction.update(runRef, { likedBy: next, likeCount: next.length });
        return { liked: !liked, likeCount: next.length };
      });
      return NextResponse.json(result);
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 500) {
      return NextResponse.json({ error: "Komentář musí mít 1 až 500 znaků." }, { status: 400 });
    }

    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    const profileData = profile.exists ? profile.data() || {} : {};
    const nickname = profileData.nickname || decoded.email?.split("@")[0] || "Uživatel";
    const avatarUrl = profileData.avatarUrl || "";
    const commentRef = adminDb.collection("runs").doc(runId).collection("comments").doc();

    await adminDb.runTransaction(async transaction => {
      const currentRun = await transaction.get(runRef);
      const currentCount = Number(currentRun.data()?.commentCount) || 0;
      transaction.set(commentRef, {
        uid: decoded.uid,
        nickname,
        avatarUrl,
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(runRef, { commentCount: currentCount + 1 });
    });

    return NextResponse.json({
      ok: true,
      comment: { id: commentRef.id, uid: decoded.uid, nickname, avatarUrl, text, mine: true },
    });
  } catch (error) {
    console.error("POST /api/runs/social:", error);
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Nejsi přihlášen." : "Operaci se nepodařilo provést." }, { status });
  }
}
