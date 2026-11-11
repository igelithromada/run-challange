import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { collectCloudinaryPublicIds, deleteCloudinaryImages, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

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
  const { decoded, adminDb } = await requireUser(request);
  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  return {
    uid: decoded.uid,
    isAdmin: decoded.admin === true || profile.data()?.role === "admin",
    adminDb,
  };
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthorizedUser(request);


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

    publicIds.push(...collectCloudinaryPublicIds(imageUrls, data.uid));
    const safePublicIds = publicIds.filter(publicId => isUserCloudinaryPublicId(publicId, data.uid));
    let cloudinaryResult = { deleted: [] as string[], failed: [] as string[] };
    try {
      cloudinaryResult = await deleteCloudinaryImages(safePublicIds);
    } catch (error) {
      console.error("Cloudinary cleanup failed while deleting run:", error);
      cloudinaryResult = { deleted: [], failed: safePublicIds };
    }

    // The activity itself is authoritative data. Never leave it undeletable
    // because a remote image cleanup failed.
    await deleteRunComments(runRef);
    await runRef.delete();

    return NextResponse.json({
      ok: true,
      deletedImages: cloudinaryResult.deleted,
      cleanupWarnings: cloudinaryResult.failed.length
        ? [`Nepodařilo se automaticky odstranit ${cloudinaryResult.failed.length} fotografii z Cloudinary.`]
        : [],
    });
  } catch (error) {
    console.error("Delete run failed:", error);
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    const message = error instanceof Error ? error.message : "";
    if (message.includes("CLOUDINARY")) {
      return NextResponse.json({ error: "Záznam nelze smazat, protože na serveru chybí nastavení Cloudinary." }, { status: 500 });
    }
    if (message.includes("FIREBASE_")) {
      return NextResponse.json({ error: "Záznam nelze smazat, protože na serveru chybí nastavení Firebase Admin." }, { status: 500 });
    }
    if (message.includes("auth/id-token") || message.includes("ID token")) {
      return NextResponse.json({ error: "Přihlášení vypršelo. Přihlas se prosím znovu a zkus smazání znovu." }, { status: 401 });
    }
    return NextResponse.json({ error: "Záznam se nepodařilo smazat. Zkus to prosím znovu." }, { status: 500 });
  }
}
