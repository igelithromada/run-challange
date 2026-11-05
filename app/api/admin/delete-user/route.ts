import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { collectCloudinaryPublicIds, deleteCloudinaryImages } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function deleteCommentsByUser(adminDb: FirebaseFirestore.Firestore, uid: string) {
  const snapshot = await adminDb.collectionGroup("comments").where("uid", "==", uid).get();
  const grouped = new Map<string, { runRef: DocumentReference; comments: FirebaseFirestore.QueryDocumentSnapshot[] }>();

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

async function deleteRunComments(runRef: DocumentReference) {
  const collections = await runRef.listCollections();
  for (const subcollection of collections) {
    const snapshot = await subcollection.get();
    for (let i = 0; i < snapshot.docs.length; i += 450) {
      const batch = runRef.firestore.batch();
      snapshot.docs.slice(i, i + 450).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
}


async function verifyAdmin(request: Request) {
  const { adminAuth, adminDb } = getAdminServices();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  if (decoded.admin === true) return decoded;

  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (profile.exists && profile.data()?.role === "admin") return decoded;
  return null;
}

async function deleteUserData(uid: string) {
  const { adminDb } = getAdminServices();
  const [runsSnapshot, userSnapshot] = await Promise.all([
    adminDb.collection("runs").where("uid", "==", uid).get(),
    adminDb.collection("users").doc(uid).get(),
  ]);

  const imageUrls: string[] = [];
  const publicIds: string[] = [];
  const userData = userSnapshot.exists ? userSnapshot.data() : undefined;

  if (typeof userData?.avatarUrl === "string") imageUrls.push(userData.avatarUrl);
  if (typeof userData?.avatarPublicId === "string" && userData.avatarPublicId) publicIds.push(userData.avatarPublicId);

  for (const run of runsSnapshot.docs) {
    const data = run.data();
    if (Array.isArray(data.imageUrls)) {
      imageUrls.push(...data.imageUrls.filter((value: unknown): value is string => typeof value === "string"));
    }
    if (typeof data.imageUrl === "string") imageUrls.push(data.imageUrl);
    if (Array.isArray(data.imagePublicIds)) {
      publicIds.push(...data.imagePublicIds.filter((value: unknown): value is string => typeof value === "string"));
    }
  }

  publicIds.push(...collectCloudinaryPublicIds(imageUrls));
  const cloudinaryResult = await deleteCloudinaryImages(publicIds);

  if (cloudinaryResult.failed.length) {
    throw new Error(`CLOUDINARY_DELETE_FAILED:${cloudinaryResult.failed.length}`);
  }

  const refs = runsSnapshot.docs.map((item) => item.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  await deleteCommentsByUser(adminDb, uid);
  await adminDb.collection("users").doc(uid).delete();

  return {
    deletedRuns: refs.length,
    deletedImages: cloudinaryResult.deleted,
  };
}

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Nemáš oprávnění k této operaci." }, { status: 403 });
    }

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
    const deleted = await deleteUserData(uid);
    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      uid,
      email: target.email || "",
      ...deleted,
    });
  } catch (error: any) {
    console.error("Admin delete user failed:", error);
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("CLOUDINARY_DELETE_FAILED:")) {
      return NextResponse.json(
        { error: "Účet nebyl smazán, protože se nepodařilo bezpečně odstranit všechny fotografie z Cloudinary. Zkontroluj Cloudinary API klíč a oprávnění." },
        { status: 502 }
      );
    }

    const status =
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/id-token-revoked" ||
      error?.code === "auth/argument-error"
        ? 401
        : error?.code === "auth/user-not-found"
          ? 404
          : 500;

    return NextResponse.json(
      { error: status === 500 ? "Účet se nepodařilo úplně odstranit." : "Požadavek se nepodařilo ověřit nebo uživatel neexistuje." },
      { status }
    );
  }
}
