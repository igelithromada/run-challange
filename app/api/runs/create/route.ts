
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { normalizeActivityType } from "../../../lib/validation";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
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
    const type = data.type === "běh" || data.type === "chůze" ? normalizeActivityType(data.type) : "";
    if (
      !Number.isFinite(km) || km <= 0 || km > 1000 ||
      !Number.isFinite(minuty) || minuty <= 0 || minuty > 24 * 60 ||
      !Number.isFinite(tempo) || tempo <= 0 || tempo > 60 ||
      !type
    ) {
      return NextResponse.json({ error: "Aktivita obsahuje neplatné údaje." }, { status: 400 });
    }

    // Team membership is no longer selected per activity. Every activity
    // automatically contributes to every team the user belongs to at the exact
    // moment the activity is created.
    const createdAt = new Date();
    const activeMemberships = await adminDb
      .collectionGroup("members")
      .where("userId", "==", decoded.uid)
      .where("active", "==", true)
      .get();

    const memberTeamIds = [...new Set(activeMemberships.docs.map(snapshot => {
      const parent = snapshot.ref.parent.parent;
      return parent ? parent.id : "";
    }).filter(Boolean))];

    const safeData = {
      uid: decoded.uid,
      email: typeof data.email === "string" ? data.email : decoded.email || "",
      nickname: typeof data.nickname === "string" ? data.nickname : "",
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      km, minuty, tempo: tempo.toFixed(2), type,
      description: typeof data.description === "string" ? data.description.trim().slice(0, 500) : "",
      timestamp: Number.isNaN(timestamp.getTime()) ? createdAt : timestamp,
      imageUrls: Array.isArray(data.imageUrls)
        ? data.imageUrls
            .filter((x): x is string => typeof x === "string")
            .filter(url => {
              const publicId = cloudinaryPublicIdFromUrl(url);
              return !!publicId && isUserCloudinaryPublicId(publicId, decoded.uid);
            })
            .slice(0, 6)
        : [],
      imagePublicIds: Array.isArray(data.imagePublicIds)
        ? data.imagePublicIds
            .filter((x): x is string => typeof x === "string")
            .filter(publicId => isUserCloudinaryPublicId(publicId, decoded.uid))
            .slice(0, 6)
        : [],
      // Legacy field kept only so old UI/data remains readable. It is not used
      // for team membership logic anymore.
      teamId: null,
      activityType: type, likedBy: [], likeCount: 0, commentCount: 0,
    };

    const ref = adminDb.collection("runs").doc();
    const runCreatedAt = Timestamp.now();
    safeData.timestamp = safeData.timestamp instanceof Date ? safeData.timestamp : createdAt;
    const batch = adminDb.batch();
    batch.create(ref, { ...safeData, createdAt: runCreatedAt });

    for (const teamId of memberTeamIds) {
      const teamRef = adminDb.collection("teams").doc(teamId);
      const contributionRef = teamRef.collection("activityContributions").doc(ref.id);
      const teamSnap = await teamRef.get();
      if (!teamSnap.exists) continue;
      batch.create(contributionRef, {
        activityId: ref.id,
        userId: decoded.uid,
        type,
        km,
        createdAt: runCreatedAt,
      });
      const stats = teamSnap.data()?.stats || {};
      const kmField = type === "chůze" ? "walkingKm" : "runningKm";
      const countField = type === "chůze" ? "walkingActivities" : "runningActivities";
      batch.update(teamRef, {
        [`stats.${kmField}`]: Number(stats[kmField] || 0) + km,
        [`stats.${countField}`]: Number(stats[countField] || 0) + 1,
      });
    }

    await batch.commit();
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/runs/create:", error);
    return NextResponse.json({ error: "Aktivitu se nepodařilo uložit." }, { status: 500 });
  }
}
