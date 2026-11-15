import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { isUserCloudinaryPublicId, cloudinaryPublicIdFromUrl } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const runId = typeof body.runId === "string" ? body.runId.trim() : "";
    const updates = body?.updates;

    if (!runId || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Neplatná data úpravy." }, { status: 400 });
    }

    const runRef = adminDb.collection("runs").doc(runId);
    const snapshot = await runRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Záznam neexistuje." }, { status: 404 });

    const current = snapshot.data() || {};
    if (current.uid !== decoded.uid) {
      return NextResponse.json({ error: "Tento záznam může upravit pouze jeho autor." }, { status: 403 });
    }

    const data = updates as Record<string, unknown>;
    const km = Number(data.km);
    const minuty = Number(data.minuty);
    const type = current.type === "chůze" ? "chůze" : "běh";

    if (!Number.isFinite(km) || km <= 0 || km > 1000 ||
        !Number.isFinite(minuty) || minuty <= 0 || minuty > 24 * 60) {
      return NextResponse.json({ error: "Aktivita obsahuje neplatnou vzdálenost nebo čas." }, { status: 400 });
    }

    const timestamp = data.timestamp instanceof Date
      ? data.timestamp
      : typeof data.timestamp === "string"
        ? new Date(data.timestamp)
        : new Date();

    if (Number.isNaN(timestamp.getTime())) {
      return NextResponse.json({ error: "Datum aktivity není platné." }, { status: 400 });
    }

    const imageUrls = Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((value): value is string => typeof value === "string").slice(0, 6)
      : Array.isArray(current.imageUrls)
        ? current.imageUrls.filter((value): value is string => typeof value === "string").slice(0, 6)
        : [];

    const imagePublicIds = Array.isArray(data.imagePublicIds)
      ? data.imagePublicIds
          .filter((value): value is string => typeof value === "string")
          .filter(publicId => isUserCloudinaryPublicId(publicId, decoded.uid))
          .slice(0, 6)
      : Array.isArray(current.imagePublicIds)
        ? current.imagePublicIds
            .filter((value): value is string => typeof value === "string")
            .filter(publicId => isUserCloudinaryPublicId(publicId, decoded.uid))
            .slice(0, 6)
        : [];

    const safeImageUrls = imageUrls.filter(url => {
      const publicId = cloudinaryPublicIdFromUrl(url);
      return !!publicId && isUserCloudinaryPublicId(publicId, decoded.uid);
    });

    await runRef.update({
      km,
      minuty,
      tempo: (minuty / km).toFixed(2),
      timestamp,
      description: typeof data.description === "string" ? data.description.trim().slice(0, 500) : String(current.description || ""),
      imageUrls: safeImageUrls,
      imageUrl: safeImageUrls[safeImageUrls.length - 1] || "",
      imagePublicIds,
      type,
      activityType: type,
    });

    return NextResponse.json({
      ok: true,
      updates: {
        km,
        minuty,
        tempo: (minuty / km).toFixed(2),
        timestamp,
        description: typeof data.description === "string" ? data.description.trim().slice(0, 500) : String(current.description || ""),
        imageUrls: safeImageUrls,
        imageUrl: safeImageUrls[safeImageUrls.length - 1] || "",
        imagePublicIds,
      },
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("PATCH /api/runs/update:", error);
    return NextResponse.json({ error: "Aktivitu se nepodařilo upravit." }, { status: 500 });
  }
}
