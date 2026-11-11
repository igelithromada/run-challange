
import { NextResponse } from "next/server";
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

    const requestedTeamId = typeof data.teamId === "string" && data.teamId.trim() ? data.teamId.trim() : null;
    let teamId: string | null = requestedTeamId;

    // Tým je pro formulář implicitní. Starší profily mohou mít teamId/teamIdsByType
    // nesynchronizované s memberIds, proto při serverovém fallbacku členství ověříme
    // oběma směry a případně najdeme aktuální tým podle typu aktivity.
    if (requestedTeamId) {
      const [teamSnapshot, userSnapshot] = await Promise.all([
        adminDb.collection("teams").doc(requestedTeamId).get(),
        adminDb.collection("users").doc(decoded.uid).get(),
      ]);
      const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
      const teamIdsByType = userData.teamIdsByType && typeof userData.teamIdsByType === "object"
        ? userData.teamIdsByType as Record<string, unknown>
        : {};

      let validTeamId: string | null = null;
      if (teamSnapshot.exists) {
        const team = teamSnapshot.data() || {};
        const teamType = team.type === "chůze" ? "chůze" : "běh";
        const memberIds = Array.isArray(team.memberIds)
          ? team.memberIds.filter((value): value is string => typeof value === "string")
          : [];
        const profileMembership =
          teamIdsByType[type] === requestedTeamId
          || (type === "běh" && userData.teamId === requestedTeamId)
          || userData.joinedTeam === requestedTeamId;

        if (teamType === type && (memberIds.includes(decoded.uid) || team.createdBy === decoded.uid || profileMembership)) {
          validTeamId = requestedTeamId;
        }
      }

      // Pokud je uložený odkaz na starý/neplatný tým, zkusíme skutečné členství.
      if (!validTeamId) {
        const memberTeams = await adminDb
          .collection("teams")
          .where("memberIds", "array-contains", decoded.uid)
          .get();
        const matchingTeam = memberTeams.docs.find(snapshot => {
          const team = snapshot.data() || {};
          return (team.type === "chůze" ? "chůze" : "běh") === type;
        });
        if (matchingTeam) validTeamId = matchingTeam.id;
      }

      // Neplatný/stárlý implicitní teamId nesmí zablokovat uložení aktivity.
      // Aktivita se uloží bez týmu, pokud se žádné platné členství nepodaří najít.
      teamId = validTeamId;
    }

    const timestamp = typeof data.timestamp === "string" ? new Date(data.timestamp) : new Date();
    const safeData = {
      uid: decoded.uid,
      email: typeof data.email === "string" ? data.email : decoded.email || "",
      nickname: typeof data.nickname === "string" ? data.nickname : "",
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      km, minuty, tempo: tempo.toFixed(2), type,
      description: typeof data.description === "string" ? data.description.trim().slice(0, 500) : "",
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
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
      teamId,
      activityType: type, likedBy: [], likeCount: 0, commentCount: 0,
    };

    const ref = await adminDb.collection("runs").add(safeData);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/runs/create:", error);
    return NextResponse.json({ error: "Aktivitu se nepodařilo uložit." }, { status: 500 });
  }
}
