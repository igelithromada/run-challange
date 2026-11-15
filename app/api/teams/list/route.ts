import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { adminDb } = await requireUser(request);
    const snap = await adminDb.collection("teams").orderBy("name").limit(200).get();
    return NextResponse.json({
      teams: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    console.error("GET /api/teams/list:", error);
    return NextResponse.json({ error: "Týmy se nepodařilo načíst." }, { status: 500 });
  }
}
