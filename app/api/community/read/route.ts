import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { getActiveTeamMemberships } from "../../../lib/teams/server";

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
