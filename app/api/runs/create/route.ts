import { createHash } from "node:crypto";
import { parseActivityDate } from "../../../lib/runData";
import { syncRunTeamContributions } from "../../../lib/teams/contributions";

import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { normalizeActivityType } from "../../../lib/validation";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";
import { reconcileChallengesForUser } from "../../../lib/challenges/server";

import { getActiveTeamMemberships } from "../../../lib/teams/server";

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
    const type = data.type === "běh" || data.type === "chůze" ? normalizeActivityType(data.type) : "";
    if (
      !Number.isFinite(km) || km <= 0 || km > 1000 ||
      !Number.isFinite(minuty) || minuty <= 0 || minuty > 24 * 60 ||
      !type
    ) {
      return NextResponse.json({ error: "Aktivita obsahuje neplatné údaje." }, { status: 400 });
    }

    // Team membership is no longer selected per activity. Every activity
    // automatically contributes to every team the user belongs to at the exact
    // moment the activity is created.
    const activityDate = parseActivityDate(data.timestamp);
    if (!activityDate) return NextResponse.json({ error: "Datum aktivity není platné." }, { status: 400 });
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    if (submissionId && !/^[a-zA-Z0-9_-]{8,128}$/.test(submissionId)) return NextResponse.json({ error: "Neplatné ID požadavku." }, { status: 400 });
    const memberTeamIds = await getActiveTeamMemberships(adminDb, decoded.uid);

    const profileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
    const profileData = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
    const canonicalNickname = typeof profileData.nickname === "string" ? profileData.nickname.trim().slice(0, 80) : "";
    const canonicalAvatarUrl = typeof profileData.avatarUrl === "string" ? profileData.avatarUrl : "";

    const safeData = {
      uid: decoded.uid,
      email: decoded.email || "",
      nickname: canonicalNickname,
      avatarUrl: canonicalAvatarUrl,
      km, minuty, tempo: (minuty / km).toFixed(2), type,
      description: typeof data.description === "string" ? data.description.trim().slice(0, 500) : "",
      timestamp: activityDate,
      teamIds: memberTeamIds,
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

    const ref = submissionId
      ? adminDb.collection("runs").doc(createHash("sha256").update(`${decoded.uid}:${submissionId}`).digest("hex"))
      : adminDb.collection("runs").doc();
    const result = await adminDb.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) return existing.data()?.deleting ? "deleting" : "existing";
      tx.create(ref, { ...safeData, createdAt: Timestamp.now() });
      return "created";
    });
    if (result === "deleting") return NextResponse.json({ error: "Aktivita se právě maže." }, { status: 409 });
    await syncRunTeamContributions(adminDb, ref.id);
    try { await reconcileChallengesForUser(adminDb, decoded.uid); }
    catch(error) { console.error("Aktivita byla uložena, přepočet výzev selhal:",error); }
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/runs/create:", error);
    return NextResponse.json({ error: "Aktivitu se nepodařilo uložit." }, { status: 500 });
  }
}
