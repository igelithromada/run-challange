import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { collectCloudinaryPublicIds, deleteCloudinaryImages, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";
import { reconcileChallengesForUser } from "../../../lib/challenges/server";

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
    let cloudinaryResult = { deleted: 0, failed: [] as string[] };
    try {
      cloudinaryResult = await deleteCloudinaryImages(safePublicIds);
    } catch (error) {
      console.error("Cloudinary cleanup failed while deleting run:", error);
      cloudinaryResult = { deleted: 0, failed: safePublicIds };
    }

    // Team contribution records are the bookkeeping layer for lifetime team
    // statistics. Remove exactly the contribution created with this activity.
    const contributions = await user.adminDb
      .collectionGroup("activityContributions")
      .where("activityId", "==", runId)
      .get();

    for(let start=0;start<contributions.docs.length;start+=225){
      const chunk=contributions.docs.slice(start,start+225);
      const batch=user.adminDb.batch();
      for(const contribution of chunk){
        const data=contribution.data()||{};
        const teamRef=contribution.ref.parent.parent;
        if(!teamRef)continue;
        const teamSnap=await teamRef.get();
        const type=data.type==="chůze"?"chůze":"běh";
        const km=Number(data.km)||0;
        const kmField=type==="chůze"?"walkingKm":"runningKm";
        const countField=type==="chůze"?"walkingActivities":"runningActivities";
        if(teamSnap.exists) {
          batch.update(teamRef,{
            [`stats.${kmField}`]:FieldValue.increment(-km),
            [`stats.${countField}`]:FieldValue.increment(-1)
          });
        }
        batch.delete(contribution.ref);
      }
      await batch.commit();
    }

    // The activity itself is authoritative data. Never leave it undeletable
    // because a remote image cleanup failed.
    await deleteRunComments(runRef);
    const runBatch=user.adminDb.batch();
    runBatch.delete(runRef);
    await runBatch.commit();
    await reconcileChallengesForUser(user.adminDb, data.uid);

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
