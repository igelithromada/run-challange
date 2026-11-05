import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminServices } from "../../lib/firebaseAdmin";
import { collectCloudinaryPublicIds, deleteCloudinaryImages } from "../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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


async function getAuthorizedUser(request: Request) {
  const { adminAuth, adminDb } = getAdminServices();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  return {
    uid: decoded.uid,
    isAdmin: decoded.admin === true || (profile.exists && profile.data()?.role === "admin"),
    adminDb,
  };
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthorizedUser(request);
    if (!user) return NextResponse.json({ error: "Neautorizovaný požadavek." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    if (!runId) return NextResponse.json({ error: "Chybí ID záznamu." }, { status: 400 });

    const runRef = user.adminDb.collection("runs").doc(runId);
    const runSnapshot = await runRef.get();
    if (!runSnapshot.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });

    const data = runSnapshot.data() || {};
    if (data.uid !== user.uid && !user.isAdmin) {
      return NextResponse.json({ error: "Nemáš oprávnění tento záznam smazat." }, { status: 403 });
    }

    const imageUrls: string[] = [];
    const publicIds: string[] = [];
    if (Array.isArray(data.imageUrls)) {
      imageUrls.push(...data.imageUrls.filter((value: unknown): value is string => typeof value === "string"));
    }
    if (typeof data.imageUrl === "string") imageUrls.push(data.imageUrl);
    if (Array.isArray(data.imagePublicIds)) {
      publicIds.push(...data.imagePublicIds.filter((value: unknown): value is string => typeof value === "string"));
    }

    publicIds.push(...collectCloudinaryPublicIds(imageUrls));
    const cloudinaryResult = await deleteCloudinaryImages(publicIds);
    if (cloudinaryResult.failed.length) {
      return NextResponse.json(
        { error: "Záznam nebyl smazán, protože se nepodařilo bezpečně odstranit všechny fotografie z Cloudinary." },
        { status: 502 }
      );
    }

    await deleteRunComments(runRef);
    await runRef.delete();

    return NextResponse.json({
      ok: true,
      deletedImages: cloudinaryResult.deleted,
    });
  } catch (error) {
    console.error("Delete run failed:", error);
    return NextResponse.json({ error: "Záznam se nepodařilo smazat." }, { status: 500 });
  }
}
