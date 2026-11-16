import { NextResponse } from "next/server";
import { FieldPath, FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireUser as requireApiUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SOCIAL_COMMENTS = 100;
const MAX_SOCIAL_LIKE_USERS = 100;

async function createSocialNotification(
  adminDb: Firestore,
  recipientUid: string,
  actorUid: string,
  actorNickname: string,
  actorAvatarUrl: string,
  type: "like" | "comment",
  runId: string,
  commentText?: string
) {
  if (!recipientUid || recipientUid === actorUid) return;
  const recipientProfile = await adminDb.collection("users").doc(recipientUid).get();
  const recipientData = recipientProfile.exists ? recipientProfile.data() || {} : {};
  const preferences = recipientData.socialNotifications || {};
  if (type === "like" && preferences.likes === false) return;
  if (type === "comment" && preferences.comments === false) return;
  const title = type === "like" ? "Nové To se mi líbí" : "Nový komentář";
  const body = type === "like"
    ? `${actorNickname} dal To se mi líbí na tvůj záznam.`
    : `${actorNickname} okomentoval tvůj záznam${commentText ? `: "${commentText.slice(0, 80)}"` : "."}`;
  await adminDb.collection("notifications").add({
    recipientUid,
    actorUid,
    actorNickname,
    actorAvatarUrl,
    type: `social_${type}`,
    title,
    body,
    runId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function isAdminUser(adminDb: Firestore, uid: string, claim: boolean): Promise<boolean> {
  if (claim) return true;
  const profile = await adminDb.collection("users").doc(uid).get();
  return profile.data()?.role === "admin";
}


export async function GET(request: Request) {
  try {
    const { adminDb, decoded } = await requireApiUser(request);
    const runId = new URL(request.url).searchParams.get("runId")?.trim();
    if (!runId) return NextResponse.json({ error: "Chybí ID záznamu." }, { status: 400 });

    const run = await adminDb.collection("runs").doc(runId).get();
    if (!run.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });
    const data = run.data() || {};
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy.filter((id): id is string => typeof id === "string") : [];

    const commentsSnapshot = await adminDb
      .collection("runs").doc(runId).collection("comments")
      .orderBy("createdAt", "asc")
      .limit(MAX_SOCIAL_COMMENTS + 1)
      .get();

    const commentsTruncated = commentsSnapshot.docs.length > MAX_SOCIAL_COMMENTS;
    const commentDocs = commentsTruncated ? commentsSnapshot.docs.slice(0, MAX_SOCIAL_COMMENTS) : commentsSnapshot.docs;
    const comments = commentDocs.map(comment => {
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
    const likesTruncated = uniqueLikeIds.length > MAX_SOCIAL_LIKE_USERS;
    const visibleLikeIds = uniqueLikeIds.slice(0, MAX_SOCIAL_LIKE_USERS);
    const likeUsers: Array<{ uid: string; nickname: string; avatarUrl: string }> = [];
    for (let i = 0; i < visibleLikeIds.length; i += 30) {
      const chunk = visibleLikeIds.slice(i, i + 30);
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

    const isAdmin = await isAdminUser(adminDb, decoded.uid, decoded.admin === true);

    return NextResponse.json({
      liked: likedBy.includes(decoded.uid),
      likeCount: Number(data.likeCount) || likedBy.length,
      commentCount: Number(data.commentCount) || comments.length,
      likes: likeUsers,
      comments,
      commentsTruncated,
      likesTruncated,
      isAdmin,
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    return NextResponse.json({ error: "Sociální data se nepodařilo načíst." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { adminDb, decoded } = await requireApiUser(request);
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
      const isAdmin = await isAdminUser(adminDb, decoded.uid, decoded.admin === true);
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
      if (result.liked && runData.uid && runData.uid !== decoded.uid) {
        const publicProfile = await adminDb.collection("publicProfiles").doc(decoded.uid).get();
        const profile = publicProfile.exists ? publicProfile.data() || {} : {};
        const actorNickname = typeof profile.nickname === "string" && profile.nickname.trim() ? profile.nickname : "Uživatel";
        const actorAvatarUrl = typeof profile.avatarUrl === "string" ? profile.avatarUrl : "";
        await createSocialNotification(adminDb, runData.uid, decoded.uid, actorNickname, actorAvatarUrl, "like", runId);
      }
      return NextResponse.json(result);
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 500) {
      return NextResponse.json({ error: "Komentář musí mít 1 až 500 znaků." }, { status: 400 });
    }

    const publicProfile = await adminDb.collection("publicProfiles").doc(decoded.uid).get();
    const publicProfileData = publicProfile.exists ? publicProfile.data() || {} : {};
    const nickname = typeof publicProfileData.nickname === "string" && publicProfileData.nickname.trim() ? publicProfileData.nickname : "Uživatel";
    const avatarUrl = typeof publicProfileData.avatarUrl === "string" ? publicProfileData.avatarUrl : "";
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

    if (runData.uid && runData.uid !== decoded.uid) {
      await createSocialNotification(adminDb, runData.uid, decoded.uid, nickname, avatarUrl, "comment", runId, text);
    }

    return NextResponse.json({
      ok: true,
      comment: { id: commentRef.id, uid: decoded.uid, nickname, avatarUrl, text, mine: true },
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/runs/social:", error);
    return NextResponse.json({ error: "Operaci se nepodařilo provést." }, { status: 500 });
  }
}
