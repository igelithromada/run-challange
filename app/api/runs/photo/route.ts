import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { deleteCloudinaryImages, collectCloudinaryPublicIds, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    const isAdmin = decoded.admin === true || profile.data()?.role === "admin";

    const body = await request.json().catch(() => ({}));
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    const index = Number(body.index);
    if (!runId || runId.includes("/") || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Chybí platné ID záznamu nebo fotografie." }, { status: 400 });
    }

    const runRef = adminDb.collection("runs").doc(runId);
    const snapshot = await runRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });
    const data = snapshot.data() || {};
    if (data.uid !== decoded.uid && !isAdmin) {
      return NextResponse.json({ error: "Nemáš oprávnění tuto fotografii smazat." }, { status: 403 });
    }

    const images = Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
      : typeof data.imageUrl === "string" && data.imageUrl ? [data.imageUrl] : [];
    if (index >= images.length) return NextResponse.json({ error: "Fotografie už neexistuje." }, { status: 404 });

    if(data.deleting)return NextResponse.json({error:"Záznam se právě maže."},{status:409});
    const removedUrl=images[index];
    const idsToDelete=collectCloudinaryPublicIds([removedUrl],data.uid);
    if (idsToDelete.length) {
      const cloudinaryResult = await deleteCloudinaryImages(idsToDelete);
      if (cloudinaryResult.failed.length) {
        return NextResponse.json({ error: "Fotografii se nepodařilo odstranit z úložiště, proto zůstala zachována." }, { status: 502 });
      }
    }

    const nextImages=await adminDb.runTransaction(async tx=>{
      const latest=await tx.get(runRef);
      if(!latest.exists)return [];
      const current=latest.data()||{};
      const currentImages=Array.isArray(current.imageUrls)?current.imageUrls:current.imageUrl?[current.imageUrl]:[];
      const removedIndex=currentImages.indexOf(removedUrl);
      const remaining=currentImages.filter((_:unknown,i:number)=>i!==removedIndex);
      tx.update(runRef,{imageUrls:remaining,imageUrl:remaining[remaining.length-1]||"",imagePublicIds:remaining.map((url:string)=>collectCloudinaryPublicIds([url],data.uid)[0]||"")});
      return remaining;
    });
    return NextResponse.json({ ok: true, imageUrls: nextImages });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

    console.error("DELETE /api/runs/photo:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("CLOUDINARY")) return NextResponse.json({ error: "Mazání fotografie není na serveru správně nakonfigurované." }, { status: 500 });
    return NextResponse.json({ error: "Fotografii se nepodařilo smazat. Zkus to prosím znovu." }, { status: 500 });
  }
}
