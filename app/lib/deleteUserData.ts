import type { DocumentReference, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { collectCloudinaryPublicIds, deleteCloudinaryImages, isUserCloudinaryPublicId } from "./cloudinaryAdmin";

async function deleteSubcollections(ref: DocumentReference) {
  const collections = await ref.listCollections();
  for (const subcollection of collections) {
    const snapshot = await subcollection.get();
    for (let i = 0; i < snapshot.docs.length; i += 450) {
      const batch = ref.firestore.batch();
      snapshot.docs.slice(i, i + 450).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
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
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = adminDb.batch();
    snapshot.docs.slice(i, i + 400).forEach(run => {
      const currentCount = Number(run.data().likeCount) || 0;
      batch.update(run.ref, {
        likedBy: FieldValue.arrayRemove(uid),
        likeCount: Math.max(0, currentCount - 1),
      });
    });
    await batch.commit();
  }
  return snapshot.size;
}

async function removeUserNotifications(adminDb: Firestore, uid: string) {
  const [recipient, actor] = await Promise.all([
    adminDb.collection("notifications").where("recipientUid", "==", uid).get(),
    adminDb.collection("notifications").where("actorUid", "==", uid).get(),
  ]);
  const refs = new Map<string, DocumentReference>();
  [...recipient.docs, ...actor.docs].forEach(doc => refs.set(doc.ref.path, doc.ref));
  const list = [...refs.values()];
  for (let i = 0; i < list.length; i += 450) {
    const batch = adminDb.batch();
    list.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return list.length;
}

async function removeUserFromTeams(adminDb: Firestore, uid: string) {
  const [memberSnapshot, ownedSnapshot] = await Promise.all([
    adminDb.collection("teams").where("memberIds", "array-contains", uid).get(),
    adminDb.collection("teams").where("createdBy", "==", uid).get(),
  ]);

  const ownedIds = new Set(ownedSnapshot.docs.map(doc => doc.id));
  const allTeams = new Map<string, QueryDocumentSnapshot>();
  [...memberSnapshot.docs, ...ownedSnapshot.docs].forEach(doc => allTeams.set(doc.id, doc));

  for (const team of allTeams.values()) {
    const data = team.data() || {};
    const type = data.type === "chůze" ? "chůze" : "běh";
    const memberIds = Array.isArray(data.memberIds)
      ? data.memberIds.filter((value): value is string => typeof value === "string")
      : [];

    if (ownedIds.has(team.id)) {
      const remaining = memberIds.filter(memberId => memberId !== uid);
      for (let i = 0; i < remaining.length; i += 450) {
        const batch = adminDb.batch();
        remaining.slice(i, i + 450).forEach(memberId => {
          batch.set(adminDb.collection("users").doc(memberId), {
            [`teamIdsByType.${type}`]: null,
            ...(type === "běh" ? { teamId: null, joinedTeam: null } : {}),
          }, { merge: true });
        });
        if (i + 450 >= remaining.length) batch.delete(team.ref);
        await batch.commit();
      }
      if (remaining.length === 0) await team.ref.delete();
    } else {
      await team.ref.update({ memberIds: FieldValue.arrayRemove(uid) });
    }
  }
  return allTeams.size;
}

export async function deleteUserData(adminDb: Firestore, uid: string) {
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
    if (Array.isArray(data.imageUrls)) imageUrls.push(...data.imageUrls.filter((value: unknown): value is string => typeof value === "string"));
    if (typeof data.imageUrl === "string") imageUrls.push(data.imageUrl);
    if (Array.isArray(data.imagePublicIds)) {
      publicIds.push(...data.imagePublicIds.filter((value: unknown): value is string => typeof value === "string" && isUserCloudinaryPublicId(value, uid)));
    }
  }

  publicIds.push(...collectCloudinaryPublicIds(imageUrls, uid));
  const cloudinaryResult = await deleteCloudinaryImages(publicIds);
  if (cloudinaryResult.failed.length) throw new Error(`CLOUDINARY_DELETE_FAILED:${cloudinaryResult.failed.length}`);

  for (const run of runsSnapshot.docs) await deleteSubcollections(run.ref);

  const runRefs = runsSnapshot.docs.map(run => run.ref);
  for (let i = 0; i < runRefs.length; i += 450) {
    const batch = adminDb.batch();
    runRefs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  const [deletedComments, removedLikes, removedNotifications, cleanedTeams] = await Promise.all([
    deleteCommentsByUser(adminDb, uid),
    removeUserLikes(adminDb, uid),
    removeUserNotifications(adminDb, uid),
    removeUserFromTeams(adminDb, uid),
  ]);

  await Promise.all([
    adminDb.collection("users").doc(uid).delete(),
    adminDb.collection("publicProfiles").doc(uid).delete(),
  ]);

  return { deletedRuns: runRefs.length, deletedImages: cloudinaryResult.deleted, deletedComments, removedLikes, removedNotifications, cleanedTeams };
}
