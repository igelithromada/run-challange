import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { isActivityType, normalizeActivityType } from "../../../lib/validation";
import { reconcileChallengesForUser } from "../../../lib/challenges/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PATCH(request:Request){
  try{
    const {decoded,adminDb}=await requireUser(request);
    const body=await request.json().catch(()=>({}));
    const id=typeof body?.id==="string"?body.id.trim():"";
    const updates=body?.updates;
    if(!id || !updates || typeof updates!=="object") return NextResponse.json({error:"Neplatná data úpravy."},{status:400});

    const runRef=adminDb.collection("runs").doc(id);
    const snap=await runRef.get();
    if(!snap.exists)return NextResponse.json({error:"Záznam neexistuje."},{status:404});
    const current=snap.data()||{};
    if(current.uid!==decoded.uid)return NextResponse.json({error:"Tento záznam nemůžeš upravit."},{status:403});

    const km=Number(updates.km);
    const minuty=Number(updates.minuty);
    const timestamp=updates.timestamp instanceof Timestamp ? updates.timestamp :
      typeof updates.timestamp==="string" && !Number.isNaN(new Date(updates.timestamp).getTime()) ? Timestamp.fromDate(new Date(updates.timestamp)) : null;
    if(!Number.isFinite(km)||km<=0||km>1000||!Number.isFinite(minuty)||minuty<=0||minuty>1440||!timestamp){
      return NextResponse.json({error:"Aktivita obsahuje neplatné údaje."},{status:400});
    }

    if (updates.type !== undefined && !isActivityType(updates.type)) {
      return NextResponse.json({error:"Aktivita obsahuje neplatný typ."},{status:400});
    }
    const nextType=updates.type===undefined ? (current.type==="chůze"?"chůze":"běh") : normalizeActivityType(updates.type);
    const tempo=(minuty/km).toFixed(2);
    const safeUpdate:any={
      km,minuty,tempo,type:nextType,activityType:nextType,timestamp,
      description:typeof updates.description==="string"?updates.description.trim().slice(0,500):String(current.description||"")
    };

    const contributions=await adminDb.collectionGroup("activityContributions").where("activityId","==",id).get();
    const newKmField=nextType==="chůze"?"walkingKm":"runningKm";
    const newCountField=nextType==="chůze"?"walkingActivities":"runningActivities";
    for(let start=0;start<contributions.docs.length;start+=225){
      const chunk=contributions.docs.slice(start,start+225);
      const batch=adminDb.batch();
      for(const contribution of chunk){
        const data=contribution.data()||{};
        const teamRef=contribution.ref.parent.parent;
        if(!teamRef)continue;
        const oldType=data.type==="chůze"?"chůze":"běh";
        const oldKm=Number(data.km)||0;
        const oldKmField=oldType==="chůze"?"walkingKm":"runningKm";
        const oldCountField=oldType==="chůze"?"walkingActivities":"runningActivities";
        batch.update(teamRef,{
          [`stats.${oldKmField}`]:FieldValue.increment(-oldKm),
          [`stats.${oldCountField}`]:FieldValue.increment(-1),
          [`stats.${newKmField}`]:FieldValue.increment(km),
          [`stats.${newCountField}`]:FieldValue.increment(1)
        });
        batch.update(contribution.ref,{type:nextType,km});
      }
      await batch.commit();
    }
    const runBatch=adminDb.batch();
    runBatch.update(runRef,safeUpdate);
    await runBatch.commit();
    await reconcileChallengesForUser(adminDb,decoded.uid);
    return NextResponse.json({ok:true});
  }catch(error){
    const authError=authErrorResponse(error);
    if(authError)return NextResponse.json({error:authError.message},{status:authError.status});
    console.error("PATCH /api/runs/update:",error);
    return NextResponse.json({error:"Záznam se nepodařilo upravit."},{status:500});
  }
}
