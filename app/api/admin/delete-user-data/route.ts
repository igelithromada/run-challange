import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { requireAdmin, authErrorResponse } from "../../../lib/apiAuth";
import { collectCloudinaryPublicIds, deleteCloudinaryImages } from "../../../lib/cloudinaryAdmin";

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

export async function POST(request: Request) {
  try {
    const { decoded: admin, adminDb } = await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    if (!uid) {
      return NextResponse.json({ error: "Chybí ID uživatele." }, { status: 400 });
    }
    if (uid === admin.uid) {
      return NextResponse.json({ error: "Vlastní účet zde nemaž." }, { status: 400 });
    }

    const runsSnapshot = await adminDb.collection("runs").where("uid", "==", uid).get();

    const imageUrls: string[] = [];
    const publicIds: string[] = [];
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
      return NextResponse.json(
        { error: "Aktivity nebyly smazány, protože se nepodařilo bezpečně odstranit všechny fotografie z Cloudinary. Zkontroluj Cloudinary API klíč a oprávnění." },
        { status: 502 }
      );
    }

    const refs = runsSnapshot.docs.map((item) => item.ref);
    for (const ref of refs) await deleteRunComments(ref);
    for (let i = 0; i < refs.length; i += 450) {
      const batch = adminDb.batch();
      refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await adminDb.collection("users").doc(uid).set(
      {
        deletedDataAt: new Date().toISOString(),
        blocked: true,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      deletedRuns: refs.length,
      deletedImages: cloudinaryResult.deleted,
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

    console.error("Admin delete activity data failed:", error);
    return NextResponse.json(
      { error: "Data aktivit se nepodařilo kompletně smazat." },
      { status: 500 }
    );
  }
}
