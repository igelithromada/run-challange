import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { deleteCloudinaryImages, collectCloudinaryPublicIds } from "../../../lib/cloudinaryAdmin";

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
    if (!runId || !Number.isInteger(index) || index < 0) {
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

    const publicIds = Array.isArray(data.imagePublicIds)
      ? data.imagePublicIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const imagePublicId = publicIds[index];
    const idsToDelete = imagePublicId ? [imagePublicId] : collectCloudinaryPublicIds([images[index]]);
    if (idsToDelete.length) {
      const cloudinaryResult = await deleteCloudinaryImages(idsToDelete);
      if (cloudinaryResult.failed.length) {
        return NextResponse.json({ error: "Fotografii se nepodařilo odstranit z úložiště, proto zůstala zachována." }, { status: 502 });
      }
    }

    const nextImages = images.filter((_, i) => i !== index);
    const nextPublicIds = publicIds.filter((_, i) => i !== index);
    await runRef.update({
      imageUrls: nextImages,
      imageUrl: nextImages[0] || "",
      imagePublicIds: nextPublicIds,
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
