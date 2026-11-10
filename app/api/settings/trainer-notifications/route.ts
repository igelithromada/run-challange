import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const header=request.headers.get("authorization")||"";
    if(!header.startsWith("Bearer ")) return NextResponse.json({error:"Nejsi přihlášen."},{status:401});
    const {adminAuth,adminDb}=getAdminServices();
    const decoded=await adminAuth.verifyIdToken(header.slice(7).trim());
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
  } catch(error) {
    console.error("POST /api/settings/trainer-notifications:",error);
    return NextResponse.json({error:"Nastavení notifikací se nepodařilo uložit."},{status:500});
  }
}
