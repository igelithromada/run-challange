import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { getActiveTeamMemberships } from "../../../lib/teams/server";
import { isActivityType, isValidDateOnly } from "../../../lib/validation";
import type { ChallengeData, ChallengeList } from "../../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const resource = String(body.resource || "");
    const id = typeof body.id === "string" ? body.id : "";
    const collectionName = resource.startsWith("team") ? "teams" : "challenges";
    const snapshotData = (snap: { id: string; data(): unknown }) => ({ ...(snap.data() as Record<string, unknown>), id: snap.id });
    const reply = (data: unknown) => NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
    if (resource === "teamMemberships") return reply(await getActiveTeamMemberships(adminDb, decoded.uid));
    if (resource === "teamDirectory") {
      const snapshot = await adminDb.collection("teams").get();
      const teams = snapshot.docs.filter(doc => !doc.data().deleting);
      const joinedIds = await getActiveTeamMemberships(adminDb, decoded.uid, teams);
      return reply({ teams: teams.map(snapshotData), joinedIds });
    }
    if (resource === "challengeList") {
      const { state, activityType, monthStart, monthEnd } = body.filters ?? {};
      if (
        (state !== "active" && state !== "planned" && state !== "completed") ||
        !isActivityType(activityType) || !isValidDateOnly(monthStart) || !isValidDateOnly(monthEnd) ||
        monthStart > monthEnd
      ) {
        return NextResponse.json({ error: "Neplatný filtr výzev." }, { status: 400 });
      }

      const snapshot = await adminDb.collection("challenges").where("state", "==", state).get();
      const visible = snapshot.docs.filter(doc => {
        const challenge = doc.data();
        return !challenge.deleting && challenge.activityType === activityType &&
          typeof challenge.startDate === "string" && typeof challenge.endDate === "string" &&
          typeof challenge.name === "string" &&
          challenge.startDate <= monthEnd && challenge.endDate >= monthStart;
      });
      const items = visible.map(doc => ({ ...doc.data(), id: doc.id }) as ChallengeData)
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id));
      const joinedIds: string[] = [];
      // Batch the caller's memberships without re-reading the challenge documents.
      const membershipRefs = visible.map(doc => doc.ref.collection("participants").doc(decoded.uid));
      const batchSize = 200;
      for (let offset = 0; offset < membershipRefs.length; offset += batchSize) {
        const memberships = await adminDb.getAll(...membershipRefs.slice(offset, offset + batchSize));
        for (const membership of memberships) {
          const challengeId = membership.ref.parent.parent?.id;
          if (challengeId && membership.data()?.active === true) joinedIds.push(challengeId);
        }
      }
      return reply({ items, joinedIds } satisfies ChallengeList);
    }
    if (resource === "teams" || resource === "challenges") {
      const snapshot = await adminDb.collection(collectionName).get();
      return reply(snapshot.docs.filter(snap => !snap.data().deleting).map(snapshotData));
    }
    if (!["team", "challenge", "teamMembers", "challengeParticipants", "challengeMembership"].includes(resource)) return NextResponse.json({ error: "Neznámý požadavek." }, { status: 400 });
    if (!id || id.includes("/")) return NextResponse.json({ error: "Chybí platné ID." }, { status: 400 });
    const ref = adminDb.collection(collectionName).doc(id);
    const parent = await ref.get();
    if (!parent.exists || parent.data()?.deleting) return reply(null);
    if (resource === "team" || resource === "challenge") return reply(snapshotData(parent));
    if (resource === "teamMembers" || resource === "challengeParticipants") {
      const members = await ref.collection(resource === "teamMembers" ? "members" : "participants").where("active", "==", true).get();
      return reply(members.docs.map(snapshotData));
    }
    if (resource === "challengeMembership") {
      // Membership state is only returned for the authenticated caller.
      const member = await ref.collection("participants").doc(decoded.uid).get();
      return reply(member.exists ? snapshotData(member) : null);
    }
    return NextResponse.json({ error: "Neznámý požadavek." }, { status: 400 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/community/read:", error);
    return NextResponse.json({ error: "Data se nepodařilo načíst." }, { status: 500 });
  }
}
