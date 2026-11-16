import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An hourly scheduler is a separate deployment capability, not a device permission.
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const deliveryReady = process.env.TRAINER_PUSH_SCHEDULER_READY === "true" &&
      ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "CRON_SECRET"].every(key => Boolean(process.env[key]?.trim()));
    return NextResponse.json({ deliveryReady }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const authError = authErrorResponse(error);
    return NextResponse.json({ error: authError?.message || "Dostupnost připomínek se nepodařilo ověřit." }, { status: authError?.status || 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body=await request.json().catch(()=>({}));
    const value=body?.trainerNotifications;
    if(!value || typeof value!=="object") return NextResponse.json({error:"Neplatné nastavení notifikací."},{status:400});
    for (const key of ["todayTime", "tomorrowTime"]) {
      if (value[key] !== undefined && (typeof value[key] !== "string" || !/^([01]\d|2[0-3]):00$/.test(value[key]))) return NextResponse.json({error:"Čas upozornění musí být platná celá hodina."},{status:400});
    }
    const trainerNotifications={
      enabled:value.enabled===true,
      today:value.today!==false,
      tomorrow:value.tomorrow!==false,
      todayTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.todayTime) ? value.todayTime : "07:00",
      tomorrowTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.tomorrowTime) ? value.tomorrowTime : "18:00"
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
