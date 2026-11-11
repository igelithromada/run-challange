import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body=await request.json().catch(()=>({}));
    const value=body?.trainerNotifications;
    if(!value || typeof value!=="object") return NextResponse.json({error:"Neplatné nastavení notifikací."},{status:400});
    const trainerNotifications={
      enabled:value.enabled===true,
      today:value.today!==false,
      tomorrow:value.tomorrow!==false
    };
    await adminDb.collection("users").doc(decoded.uid).set({trainerNotifications},{merge:true});
    return NextResponse.json({ok:true,trainerNotifications});
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
    console.error("POST /api/settings/trainer-notifications:", error);
    return NextResponse.json({ error: "Nastavení notifikací se nepodařilo uložit." }, { status: 500 });
  }
}
