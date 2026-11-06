import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nejsi přihlášen." }, { status: 401 });
    }

    const token = header.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await request.json().catch(() => ({}));
    const run = body?.run;

    if (!run || typeof run !== "object") {
      return NextResponse.json({ error: "Neplatná data aktivity." }, { status: 400 });
    }

    const data = run as Record<string, unknown>;
    if (data.uid !== decoded.uid) {
      return NextResponse.json({ error: "Aktivitu můžeš uložit pouze ke svému účtu." }, { status: 403 });
    }

    const km = Number(data.km);
    const minuty = Number(data.minuty);
    const tempo = Number(data.tempo);
    const type = data.type === "chůze" ? "chůze" : data.type === "běh" ? "běh" : "";
    if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(minuty) || minuty <= 0 || !Number.isFinite(tempo) || !type) {
      return NextResponse.json({ error: "Aktivita obsahuje neplatné údaje." }, { status: 400 });
    }

    const timestamp = data.timestamp instanceof Date
      ? data.timestamp
      : typeof data.timestamp === "string"
        ? new Date(data.timestamp)
        : new Date();

    const safeData = {
      uid: decoded.uid,
      email: typeof data.email === "string" ? data.email : decoded.email || "",
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      km,
      minuty,
      tempo: tempo.toFixed(2),
      type,
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.filter((x): x is string => typeof x === "string").slice(0, 6) : [],
      imagePublicIds: Array.isArray(data.imagePublicIds) ? data.imagePublicIds.filter((x): x is string => typeof x === "string").slice(0, 6) : [],
      teamId: typeof data.teamId === "string" ? data.teamId : null,
      activityType: type,
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
    };

    const ref = await adminDb.collection("runs").add(safeData);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    console.error("POST /api/runs/create:", error);
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Nejsi přihlášen." : "Aktivitu se nepodařilo uložit." },
      { status: 500 }
    );
  }
}
