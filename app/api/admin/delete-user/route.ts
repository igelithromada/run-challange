import { NextResponse } from "next/server";
import type { DocumentReference, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { collectCloudinaryPublicIds, deleteCloudinaryImages, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deleteDocuments(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = refs[0]?.firestore.batch();
    if (!batch) return;
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteSubcollections(ref: DocumentReference) {
  const collections = await ref.listCollections();
  for (const subcollection of collections) {
    const snapshot = await subcollection.get();
    await deleteDocuments(snapshot.docs.map(doc => doc.ref));
  }
}

async function deleteCommentsByUser(adminDb: Firestore, uid: string) {
  const snapshot = await adminDb.collectionGroup("comments").where("uid", "==", uid).get();
  const grouped = new Map<string, { runRef: DocumentReference; comments: QueryDocumentSnapshot[] }>();

  for (const comment of snapshot.docs) {
    const runRef = comment.ref.parent.parent;
    if (!runRef) continue;
    const key = runRef.path;
    const group = grouped.get(key);
    if (group) group.comments.push(comment);
    else grouped.set(key, { runRef, comments: [comment] });
  }

  for (const { runRef, comments } of grouped.values()) {
    const runSnapshot = await runRef.get();
    for (let i = 0; i < comments.length; i += 400) {
      const batch = adminDb.batch();
      comments.slice(i, i + 400).forEach(comment => batch.delete(comment.ref));
      if (runSnapshot.exists && i === 0) {
        const currentCount = Number(runSnapshot.data()?.commentCount) || 0;
        batch.update(runRef, { commentCount: Math.max(0, currentCount - comments.length) });
      }
      await batch.commit();
    }
  }

  return snapshot.size;
}

async function removeUserLikes(adminDb: Firestore, uid: string) {
  const snapshot = await adminDb.collection("runs").where("likedBy", "array-contains", uid).get();
  for (let i = 0; i < snapshot.docs.length; i += 450) {
    const batch = adminDb.batch();
    snapshot.docs.slice(i, i + 450).forEach(run => {
      const data = run.data();
      const likedBy = Array.isArray(data.likedBy)
        ? data.likedBy.filter((value): value is string => typeof value === "string" && value !== uid)
        : [];
      batch.update(run.ref, {
        likedBy,
        likeCount: likedBy.length,
      });
    });
    await batch.commit();
  }
  return snapshot.size;
}

async function deleteNotificationsForUser(adminDb: Firestore, uid: string) {
  const [recipient, actor] = await Promise.all([
    adminDb.collection("notifications").where("recipientUid", "==", uid).get(),
    adminDb.collection("notifications").where("actorUid", "==", uid).get(),
  ]);

  const refs = new Map<string, DocumentReference>();
  [...recipient.docs, ...actor.docs].forEach(doc => refs.set(doc.ref.path, doc.ref));
  await deleteDocuments([...refs.values()]);
  return refs.size;
}

async function deleteUserPushSubscriptions(userRef: DocumentReference) {
  const collections = await userRef.listCollections();
  const pushSubscriptions = collections.find(collection => collection.id === "pushSubscriptions");
  if (!pushSubscriptions) return 0;
  const snapshot = await pushSubscriptions.get();
  await deleteDocuments(snapshot.docs.map(doc => doc.ref));
  return snapshot.size;
}

async function cleanupTeamsForDeletedUser(adminDb: Firestore, uid: string) {
  const [memberTeams, ownedTeams] = await Promise.all([
    adminDb.collection("teams").where("memberIds", "array-contains", uid).get(),
    adminDb.collection("teams").where("createdBy", "==", uid).get(),
  ]);

  const teamDocs = new Map<string, QueryDocumentSnapshot>();
  [...memberTeams.docs, ...ownedTeams.docs].forEach(team => teamDocs.set(team.id, team));

  const publicIds: string[] = [];
  let deletedTeams = 0;
  let removedMemberships = 0;

  for (const teamSnapshot of teamDocs.values()) {
    const team = teamSnapshot.data() || {};
    const memberIds = Array.isArray(team.memberIds)
      ? team.memberIds.filter((value): value is string => typeof value === "string")
      : [];

    if (team.createdBy === uid) {
      if (typeof team.avatarPublicId === "string" && isUserCloudinaryPublicId(team.avatarPublicId, uid)) {
        publicIds.push(team.avatarPublicId);
      }
      if (typeof team.avatarUrl === "string") {
        publicIds.push(...collectCloudinaryPublicIds([team.avatarUrl], uid));
      }

      // Firestore batches are limited to 500 writes. Clear member references
      // in chunks, then remove the team and any descendants.
      for (let i = 0; i < memberIds.length; i += 450) {
        const batch = adminDb.batch();
        memberIds.slice(i, i + 450).forEach(memberId => {
          const memberRef = adminDb.collection("users").doc(memberId);
          batch.set(
            memberRef,
            {
              [`teamIdsByType.${team.type === "chůze" ? "chůze" : "běh"}`]: null,
              ...(team.type === "běh" ? { teamId: null, joinedTeam: null } : {}),
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      await deleteSubcollections(teamSnapshot.ref);
      await teamSnapshot.ref.delete();
      deletedTeams++;
      removedMemberships += memberIds.length;
    } else {
      await teamSnapshot.ref.update({ memberIds: FieldValue.arrayRemove(uid) });
      removedMemberships++;
    }
  }

  return { deletedTeams, removedMemberships, publicIds };
}

async function deleteUserData(adminDb: Firestore, uid: string) {
  const [runsSnapshot, userSnapshot] = await Promise.all([
    adminDb.collection("runs").where("uid", "==", uid).get(),
    adminDb.collection("users").doc(uid).get(),
  ]);

  const imageUrls: string[] = [];
  const publicIds: string[] = [];
  const userData = userSnapshot.exists ? userSnapshot.data() : undefined;

  if (typeof userData?.avatarUrl === "string") imageUrls.push(userData.avatarUrl);
  if (typeof userData?.avatarPublicId === "string" && isUserCloudinaryPublicId(userData.avatarPublicId, uid)) {
    publicIds.push(userData.avatarPublicId);
  }

  for (const run of runsSnapshot.docs) {
    const data = run.data();
    if (Array.isArray(data.imageUrls)) {
      imageUrls.push(...data.imageUrls.filter((value: unknown): value is string => typeof value === "string"));
    }
    if (typeof data.imageUrl === "string") imageUrls.push(data.imageUrl);
    if (Array.isArray(data.imagePublicIds)) {
      publicIds.push(
        ...data.imagePublicIds.filter(
          (value: unknown): value is string =>
            typeof value === "string" && isUserCloudinaryPublicId(value, uid)
        )
      );
    }
  }

  const teamCleanup = await cleanupTeamsForDeletedUser(adminDb, uid);
  publicIds.push(...teamCleanup.publicIds);
  publicIds.push(...collectCloudinaryPublicIds(imageUrls, uid));

  const cloudinaryResult = await deleteCloudinaryImages(publicIds);
  if (cloudinaryResult.failed.length) {
    throw new Error(`CLOUDINARY_DELETE_FAILED:${cloudinaryResult.failed.length}`);
  }

  const deletedComments = await deleteCommentsByUser(adminDb, uid);
  const removedLikes = await removeUserLikes(adminDb, uid);
  const deletedNotifications = await deleteNotificationsForUser(adminDb, uid);
  const deletedPushSubscriptions = await deleteUserPushSubscriptions(adminDb.collection("users").doc(uid));

  // Firestore does not delete subcollections when their parent document is deleted.
  // Remove them first so a deleted run cannot leave orphaned comments or other descendants.
  for (const run of runsSnapshot.docs) {
    await deleteSubcollections(run.ref);
  }
  await deleteDocuments(runsSnapshot.docs.map(run => run.ref));

  await adminDb.collection("users").doc(uid).delete();
  await adminDb.collection("publicProfiles").doc(uid).delete();

  return {
    deletedRuns: runsSnapshot.size,
    deletedComments,
    removedLikes,
    deletedNotifications,
    deletedPushSubscriptions,
    deletedTeams: teamCleanup.deletedTeams,
    removedTeamMemberships: teamCleanup.removedMemberships,
    deletedImages: cloudinaryResult.deleted,
  };
}

export async function POST(request: Request) {
  try {
    const { decoded: admin, adminDb } = await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    if (!uid) {
      return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    }
    if (uid === admin.uid) {
      return NextResponse.json({ error: "Vlastní administrátorský účet zde nelze smazat." }, { status: 400 });
    }

    const { adminAuth } = getAdminServices();
    const target = await adminAuth.getUser(uid);
    const deleted = await deleteUserData(adminDb, uid);
    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      uid,
      email: target.email || "",
      ...deleted,
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

    console.error("Admin delete user failed:", error);
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("CLOUDINARY_DELETE_FAILED:")) {
      return NextResponse.json(
        { error: "Účet nebyl smazán, protože se nepodařilo bezpečně odstranit všechny fotografie z Cloudinary. Zkontroluj Cloudinary API klíč a oprávnění." },
        { status: 502 }
      );
    }

    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

    const status =
      code === "auth/id-token-expired" || code === "auth/id-token-revoked" || code === "auth/argument-error"
        ? 401
        : code === "auth/user-not-found"
          ? 404
          : 500;

    return NextResponse.json(
      { error: status === 500 ? "Účet se nepodařilo úplně odstranit." : "Požadavek se nepodařilo ověřit nebo uživatel neexistuje." },
      { status }
    );
  }
}
