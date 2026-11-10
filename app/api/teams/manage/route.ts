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
      await teamRef.set({ name, type, createdBy: decoded.uid, challengeGoalKm: 500, avatarUrl: "", avatarPublicId: "", memberIds: [decoded.uid] });
      const userSnap = await userRef.get();
      const data = userSnap.exists ? userSnap.data() || {} : {};
      const stored = data.teamIdsByType && typeof data.teamIdsByType === "object" ? data.teamIdsByType : {};
      const next = { ...stored, [type]: teamRef.id };
      await userRef.set({ teamIdsByType: next, ...(type === "běh" ? { teamId: teamRef.id, joinedTeam: teamRef.id } : {}) }, { merge: true });
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
      const userSnap = await userRef.get();
      const data = userSnap.exists ? userSnap.data() || {} : {};
      const stored = data.teamIdsByType && typeof data.teamIdsByType === "object" ? data.teamIdsByType : {};
      const next = { ...stored, [type]: action === "join" ? teamId : null };
      await teamRef.update({ memberIds: action === "join" ? FieldValue.arrayUnion(decoded.uid) : FieldValue.arrayRemove(decoded.uid) });
      await userRef.set({ teamIdsByType: next, ...(type === "běh" ? { teamId: action === "join" ? teamId : null, joinedTeam: action === "join" ? teamId : null } : {}) }, { merge: true });
      return NextResponse.json({ ok: true, teamIdsByType: next });
    }

    if (action === "delete") {
      if (team.createdBy !== decoded.uid) return NextResponse.json({ error: "Tým může smazat jen zakladatel." }, { status: 403 });
      const memberIds = Array.isArray(team.memberIds) ? team.memberIds.filter((value): value is string => typeof value === "string") : [];
      const batch = adminDb.batch();
      memberIds.forEach(memberId => {
        const memberRef = adminDb.collection("users").doc(memberId);
        batch.set(memberRef, {
          teamIdsByType: { [type]: null },
          ...(type === "běh" ? { teamId: null, joinedTeam: null } : {}),
        }, { merge: true });
      });
      batch.delete(teamRef);
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Neznámá operace." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/teams/manage:", error);
    const message = error instanceof Error && error.message === "UNAUTHORIZED" ? "Nejsi přihlášen." : "Operaci týmu se nepodařilo dokončit.";
    return NextResponse.json({ error: message }, { status: message === "Nejsi přihlášen." ? 401 : 500 });
  }
}
