import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeActivityType, normalizeTeamName } from "../../../lib/validation";

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
      const userSnap = await userRef.get();
      const data = userSnap.exists ? userSnap.data() || {} : {};
      const stored = data.teamIdsByType && typeof data.teamIdsByType === "object" ? data.teamIdsByType : {};
      const existingTeamId = typeof (stored as Record<string, unknown>)[type] === "string"
        ? String((stored as Record<string, unknown>)[type])
        : "";
      if (existingTeamId) {
        return NextResponse.json(
          { error: "Nejdřív opusť svůj současný tým tohoto typu." },
          { status: 409 }
        );
      }
      const next = { ...stored, [type]: teamRef.id };
      const batch = adminDb.batch();
      batch.set(teamRef, { name, type, createdBy: decoded.uid, challengeGoalKm: 500, avatarUrl: "", avatarPublicId: "", memberIds: [decoded.uid] });
      batch.set(userRef, { teamIdsByType: next, ...(type === "běh" ? { teamId: teamRef.id, joinedTeam: teamRef.id } : {}) }, { merge: true });
      await batch.commit();
      return NextResponse.json({ ok: true, team: { id: teamRef.id, name, type, createdBy: decoded.uid, challengeGoalKm: 500 } });
    }

    const teamId = String(body?.teamId || "");
    if (!teamId) return NextResponse.json({ error: "Chybí tým." }, { status: 400 });
    const teamRef = adminDb.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) return NextResponse.json({ error: "Tým neexistuje." }, { status: 404 });
    const team = teamSnap.data() || {};
    const type = team.type === "chůze" ? "chůze" : "běh";

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

        if (action === "join" && currentTeamId === teamId) {
          return { next: { ...stored, [type]: teamId }, changed: false };
        }

        if (action === "leave" && currentTeamId !== teamId) {
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
          transaction.update(teamRef, { memberIds: FieldValue.arrayUnion(decoded.uid) });
        } else {
          transaction.update(teamRef, { memberIds: FieldValue.arrayRemove(decoded.uid) });
        }

        const next = { ...stored, [type]: action === "join" ? teamId : null };
        transaction.set(
          userRef,
          {
            teamIdsByType: next,
            ...(type === "běh"
              ? {
                  teamId: action === "join" ? teamId : null,
                  joinedTeam: action === "join" ? teamId : null,
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
        : errorMessage === "TEAM_NOT_FOUND"
          ? "Tým už neexistuje."
          : "Operaci týmu se nepodařilo dokončit.";
    return NextResponse.json({ error: message }, { status: message === "Nejsi přihlášen." ? 401 : 500 });
  }
}
