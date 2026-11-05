import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { deleteCloudinaryImages, collectCloudinaryPublicIds } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUser(request: Request) {
  const { adminAuth, adminDb } = getAdminServices();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new Error("UNAUTHORIZED");
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
    const user = await getUser(request);
    const body = await request.json().catch(() => ({}));
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    const index = Number(body.index);
    if (!runId || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Chybí platné ID záznamu nebo fotografie." }, { status: 400 });
    }

    const runRef = user.adminDb.collection("runs").doc(runId);
    const snapshot = await runRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });
    const data = snapshot.data() || {};
    if (data.uid !== user.uid && !user.isAdmin) {
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
    console.error("DELETE /api/runs/photo:", error);
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Nejsi přihlášen." }, { status: 401 });
    if (message.includes("CLOUDINARY")) return NextResponse.json({ error: "Mazání fotografie není na serveru správně nakonfigurované." }, { status: 500 });
    return NextResponse.json({ error: "Fotografii se nepodařilo smazat. Zkus to prosím znovu." }, { status: 500 });
  }
}
