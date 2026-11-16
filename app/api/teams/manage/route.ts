import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeActivityType, normalizeTeamName } from "../../../lib/validation";
import { cloudinaryPublicIdFromUrl, deleteCloudinaryImages, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const userRef = adminDb.collection("users").doc(decoded.uid);

    if (action === "create") {
      const name = normalizeTeamName(body?.name);
      const type = normalizeActivityType(body?.type);
      if (!name) return NextResponse.json({ error: "Zadej název týmu." }, { status: 400 });
      const teamRef = adminDb.collection("teams").doc();
      // The membership check and team creation must be atomic: two requests
      // must never create two teams for the same user's activity type.
      await adminDb.runTransaction(async transaction => {
        const userSnap = await transaction.get(userRef);
        const data = userSnap.exists ? userSnap.data() || {} : {};
        const stored = data.teamIdsByType && typeof data.teamIdsByType === "object"
          ? data.teamIdsByType as Record<string, unknown> : {};
        const existingTeamId = typeof stored[type] === "string" ? String(stored[type]) : "";
        if (existingTeamId) throw new Error("TEAM_ALREADY_JOINED");
        const next = { ...stored, [type]: teamRef.id };
        transaction.create(teamRef, { name, type, createdBy: decoded.uid, challengeGoalKm: 500, avatarUrl: "", avatarPublicId: "", memberIds: [decoded.uid] });
        transaction.set(userRef, { teamIdsByType: next, ...(type === "běh" ? { teamId: teamRef.id, joinedTeam: teamRef.id } : {}) }, { merge: true });
      });
      return NextResponse.json({ ok: true, team: { id: teamRef.id, name, type, createdBy: decoded.uid, challengeGoalKm: 500 } });
    }

    const teamId = String(body?.teamId || "");
    if (!teamId) return NextResponse.json({ error: "Chybí tým." }, { status: 400 });
    const teamRef = adminDb.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) return NextResponse.json({ error: "Tým neexistuje." }, { status: 404 });
    const team = teamSnap.data() || {};
    const type = team.type === "chůze" ? "chůze" : "běh";

    if (action === "update") {
      if (team.createdBy !== decoded.uid) return NextResponse.json({ error: "Nastavení může měnit jen zakladatel týmu." }, { status: 403 });

      const challengeGoalKm = Number(body?.challengeGoalKm);
      if (!Number.isFinite(challengeGoalKm) || challengeGoalKm <= 0 || challengeGoalKm > 100000) {
        return NextResponse.json({ error: "Zadej platný cíl týmu." }, { status: 400 });
      }

      const avatarUrl = typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : "";
      const avatarPublicId = typeof body?.avatarPublicId === "string" ? body.avatarPublicId.trim() : "";
      if (avatarUrl) {
        const parsedPublicId = cloudinaryPublicIdFromUrl(avatarUrl);
        if (
          !avatarUrl.startsWith("https://res.cloudinary.com/") ||
          !parsedPublicId ||
          !isUserCloudinaryPublicId(parsedPublicId, decoded.uid) ||
          (avatarPublicId && avatarPublicId !== parsedPublicId)
        ) {
          return NextResponse.json({ error: "Avatar týmu má neplatný zdroj." }, { status: 400 });
        }
      }
      if (avatarPublicId && !isUserCloudinaryPublicId(avatarPublicId, decoded.uid)) {
        return NextResponse.json({ error: "Avatar týmu má neplatné ID." }, { status: 400 });
      }

      const previousPublicId = typeof team.avatarPublicId === "string" ? team.avatarPublicId : "";
      await teamRef.set(
        { challengeGoalKm, avatarUrl, avatarPublicId },
        { merge: true }
      );

      if (
        previousPublicId &&
        previousPublicId !== avatarPublicId &&
        isUserCloudinaryPublicId(previousPublicId, decoded.uid)
      ) {
        const cleanup = await deleteCloudinaryImages([previousPublicId]);
        if (cleanup.failed.length) {
          console.warn("Starý avatar týmu se nepodařilo odstranit z Cloudinary:", cleanup.failed);
        }
      }

      return NextResponse.json({ ok: true, challengeGoalKm, avatarUrl, avatarPublicId });
    }

    if (action === "rename") {
      if (team.createdBy !== decoded.uid) return NextResponse.json({ error: "Název může měnit jen zakladatel týmu." }, { status: 403 });
      const name = normalizeTeamName(body?.name);
      if (!name) return NextResponse.json({ error: "Zadej název týmu." }, { status: 400 });
      await teamRef.set({ name }, { merge: true });
      return NextResponse.json({ ok: true, name });
    }

    if (action === "join" || action === "leave") {
      const result = await adminDb.runTransaction(async transaction => {
        const [userSnap, targetTeamSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(teamRef),
        ]);
        if (!targetTeamSnap.exists) {
          throw new Error("TEAM_NOT_FOUND");
        }
        const data = userSnap.exists ? userSnap.data() || {} : {};
        const stored = data.teamIdsByType && typeof data.teamIdsByType === "object"
          ? data.teamIdsByType as Record<string, unknown>
          : {};
        const currentTeamId = typeof stored[type] === "string" ? String(stored[type]) : "";

        const targetMemberIds = Array.isArray(targetTeamSnap.data()?.memberIds)
          ? (targetTeamSnap.data()?.memberIds as unknown[]).filter((value): value is string => typeof value === "string")
          : [];
        const isTargetMember = targetMemberIds.includes(decoded.uid);

        if (action === "join" && isTargetMember && currentTeamId === teamId) {
          return { next: { ...stored, [type]: teamId }, changed: false };
        }

        if (action === "leave" && !isTargetMember && currentTeamId !== teamId) {
          return { next: { ...stored, [type]: currentTeamId || null }, changed: false };
        }

        const oldTeamRef = currentTeamId && currentTeamId !== teamId
          ? adminDb.collection("teams").doc(currentTeamId)
          : null;
        if (oldTeamRef) {
          const oldTeamSnap = await transaction.get(oldTeamRef);
          if (oldTeamSnap.exists) {
            transaction.update(oldTeamRef, { memberIds: FieldValue.arrayRemove(decoded.uid) });
          }
        }

        if (action === "join") {
          if (!isTargetMember) transaction.update(teamRef, { memberIds: FieldValue.arrayUnion(decoded.uid) });
        } else {
          if (isTargetMember) transaction.update(teamRef, { memberIds: FieldValue.arrayRemove(decoded.uid) });
        }

        const next = { ...stored, [type]: action === "join" ? teamId : (currentTeamId === teamId ? null : currentTeamId || null) };
        transaction.set(
          userRef,
          {
            teamIdsByType: next,
            ...(type === "běh"
              ? {
                  teamId: next[type],
                  joinedTeam: next[type],
                }
              : {}),
          },
          { merge: true }
        );
        return { next, changed: true };
      });

      return NextResponse.json({ ok: true, teamIdsByType: result.next, changed: result.changed });
    }

    if (action === "delete") {
      if (team.createdBy !== decoded.uid) return NextResponse.json({ error: "Tým může smazat jen zakladatel." }, { status: 403 });
      const memberIds = Array.isArray(team.memberIds) ? team.memberIds.filter((value): value is string => typeof value === "string") : [];
      for (let i = 0; i < memberIds.length; i += 450) {
        const batch = adminDb.batch();
        memberIds.slice(i, i + 450).forEach(memberId => {
          const memberRef = adminDb.collection("users").doc(memberId);
          batch.set(memberRef, {
            [`teamIdsByType.${type}`]: null,
            ...(type === "běh" ? { teamId: null, joinedTeam: null } : {}),
          }, { merge: true });
        });
        if (i + 450 >= memberIds.length) batch.delete(teamRef);
        await batch.commit();
      }
      if (memberIds.length === 0) {
        await teamRef.delete();
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Neznámá operace." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/teams/manage:", error);
    const errorMessage = error instanceof Error ? error.message : "";
    const message =
      errorMessage === "UNAUTHORIZED"
        ? "Nejsi přihlášen."
        : errorMessage === "TEAM_ALREADY_JOINED"
          ? "Nejdřív opusť svůj současný tým tohoto typu."
          : errorMessage === "TEAM_NOT_FOUND"
          ? "Tým už neexistuje."
          : "Operaci týmu se nepodařilo dokončit.";
    return NextResponse.json({ error: message }, { status: message === "Nejsi přihlášen." ? 401 : errorMessage === "TEAM_ALREADY_JOINED" ? 409 : errorMessage === "TEAM_NOT_FOUND" ? 404 : 500 });
  }
}
