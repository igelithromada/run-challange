import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { deleteCloudinaryImages, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const publicIds = Array.isArray(body.publicIds)
      ? body.publicIds.filter((value: unknown): value is string =>
          typeof value === "string" && isUserCloudinaryPublicId(value, decoded.uid)
        )
      : [];

    if (!publicIds.length) return NextResponse.json({ ok: true, deleted: 0, failed: [] });

    const result = await deleteCloudinaryImages([...new Set(publicIds)]);
    return NextResponse.json({ ok: result.failed.length === 0, ...result }, { status: result.failed.length ? 502 : 200 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/media/delete:", error);
    return NextResponse.json({ error: "Obrázky se nepodařilo odstranit." }, { status: 500 });
  }
}
