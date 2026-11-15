import type { DocumentReference, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { collectCloudinaryPublicIds, deleteCloudinaryImages, isUserCloudinaryPublicId } from "./cloudinaryAdmin";
import { reconcileChallengesForUser } from "./challenges/server";

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

async function removeUserFromChallenges(adminDb: Firestore, uid: string) {
  const participantSnapshot = await adminDb.collectionGroup("participants").where("userId", "==", uid).get();

  for (let i = 0; i < participantSnapshot.docs.length; i += 400) {
    const batch = adminDb.batch();
    for (const participant of participantSnapshot.docs.slice(i, i + 400)) {
      batch.set(participant.ref, {
        active: false,
        leftAt: FieldValue.serverTimestamp(),
        deletedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }

  // Reconcile all active challenges once after the account is removed.
  // This recalculates shared goals without repeatedly scanning the same
  // challenges for every participant document.
  if (participantSnapshot.size > 0) {
    await reconcileChallengesForUser(adminDb, uid);
  }

  return participantSnapshot.size;
}

async function removeUserFromTeams(adminDb: Firestore, uid: string) {
  const membershipSnapshot = await adminDb.collectionGroup("members")
    .where("userId", "==", uid)
    .where("active", "==", true)
    .get();

  let cleaned = 0;
  for (const member of membershipSnapshot.docs) {
    const teamRef = member.ref.parent.parent;
    if (!teamRef) continue;
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) continue;
    const team = teamSnap.data() || {};
    const wasManager = team.managerId === uid;

    const activeMembers = await teamRef.collection("members").where("active", "==", true).get();
    const replacement = activeMembers.docs.find(d => d.id !== uid);

    const batch = adminDb.batch();
    batch.delete(member.ref);

    if (wasManager) {
      if (replacement) {
        batch.update(teamRef, { managerId: replacement.id, memberCount: FieldValue.increment(-1) });
        batch.set(replacement.ref, { managerTransferredAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        // The account being deleted is the sole member. Preserve the team and
        // its historical statistics; the team simply has no current manager.
        batch.update(teamRef, { managerId: null, memberCount: 0 });
      }
    } else {
      batch.update(teamRef, { memberCount: FieldValue.increment(-1) });
    }

    await batch.commit();
    cleaned++;
  }

  // Membership history and activityContributions are deliberately preserved:
  // they are the source of historical team statistics.
  return cleaned;
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

  const [deletedComments, removedLikes, removedNotifications, cleanedTeams, cleanedChallenges] = await Promise.all([
    deleteCommentsByUser(adminDb, uid),
    removeUserLikes(adminDb, uid),
    removeUserNotifications(adminDb, uid),
    removeUserFromTeams(adminDb, uid),
    removeUserFromChallenges(adminDb, uid),
  ]);

  await Promise.all([
    adminDb.collection("users").doc(uid).delete(),
    adminDb.collection("publicProfiles").doc(uid).delete(),
  ]);

  return { deletedRuns: runRefs.length, deletedImages: cloudinaryResult.deleted, deletedComments, removedLikes, removedNotifications, cleanedTeams, cleanedChallenges };
}
