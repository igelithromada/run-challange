import { notifyChallengeState } from "../../../lib/notifications/community";
import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/firebaseAdmin";
import { reconcileChallengeState } from "../../../lib/challenges/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    const secret=process.env.CRON_SECRET?.trim();
    const auth=request.headers.get("authorization")||"";
    if(!secret || auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});

    const {adminDb}=getAdminServices();
    const snapshot=await adminDb.collection("challenges")
      .where("state","in",["planned","active"])
      .get();

    let processed=0;
    for(const doc of snapshot.docs){
      await reconcileChallengeState(adminDb,doc.id);
      processed++;
    }
    // Retry unfinished deliveries even when the challenge is already completed.
    const pending = await adminDb.collection("challenges").where("notificationPending", "==", true).get();
    for (const doc of pending.docs) await notifyChallengeState(adminDb, doc.id);
    return NextResponse.json({ok:true,processed});
  }catch(error){
    console.error("GET /api/challenges/lifecycle:",error);
    return NextResponse.json({error:"Životní cyklus výzev se nepodařilo zpracovat."},{status:500});
  }
}
