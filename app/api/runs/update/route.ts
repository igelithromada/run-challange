import { recordActivityType, validateActivityValues } from "../../../lib/activity";
import { parseActivityDate } from "../../../lib/runData";
import { syncRunTeamContributions } from "../../../lib/teams/contributions";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
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
    if(!id || id.includes("/") || !updates || typeof updates!=="object") return NextResponse.json({error:"Neplatná data úpravy."},{status:400});

    const runRef=adminDb.collection("runs").doc(id);
    const snap=await runRef.get();
    if(!snap.exists)return NextResponse.json({error:"Záznam neexistuje."},{status:404});
    const current=snap.data()||{};
    if(current.uid!==decoded.uid)return NextResponse.json({error:"Tento záznam nemůžeš upravit."},{status:403});

    const nextType = normalizeActivityType(updates.type === undefined ? recordActivityType(current) : updates.type);
    const values = validateActivityValues(nextType, updates);
    const date=parseActivityDate(updates.timestamp);
    const timestamp=date ? Timestamp.fromDate(date) : null;
    if (!values || !timestamp || (updates.type !== undefined && !isActivityType(updates.type))) return NextResponse.json({error:"Aktivita obsahuje neplatné údaje."},{status:400});
    const safeUpdate:any={
      ...values,type:nextType,activityType:nextType,timestamp,
      description:typeof updates.description==="string"?updates.description.trim().slice(0,500):String(current.description||"")
    };

    await adminDb.runTransaction(async tx => {
      const snapshot=await tx.get(runRef);
      const latest=snapshot.data();
      if(!latest)throw new Error("RUN_NOT_FOUND");
      if(latest.uid!==decoded.uid)throw new Error("RUN_FORBIDDEN");
      if(latest.deleting)throw new Error("RUN_DELETING");
      if(updates.imageUrls!==undefined){
        if(!Array.isArray(updates.imageUrls) || updates.imageUrls.length>6)throw new Error("INVALID_IMAGES");
        const existingImages=Array.isArray(latest.imageUrls)?latest.imageUrls:latest.imageUrl?[latest.imageUrl]:[];
        const images=updates.imageUrls;
        if(images.some((url:unknown)=> typeof url!=="string" || (!existingImages.includes(url) && !isUserCloudinaryPublicId(cloudinaryPublicIdFromUrl(url)||"",decoded.uid))))throw new Error("INVALID_IMAGES");
        safeUpdate.imageUrls=images;
        safeUpdate.imageUrl=images[images.length-1]||"";
        safeUpdate.imagePublicIds=images.map((url:string)=>cloudinaryPublicIdFromUrl(url)||"");
      }
      tx.update(runRef,safeUpdate);
    });
    await syncRunTeamContributions(adminDb,id);
    try { await reconcileChallengesForUser(adminDb,decoded.uid); }
    catch(error) { console.error("Aktivita byla uložena, přepočet výzev selhal:",error); }
    return NextResponse.json({ok:true});
  }catch(error){
    const authError=authErrorResponse(error);
    if(authError)return NextResponse.json({error:authError.message},{status:authError.status});
    const code=error instanceof Error?error.message:"";
    const known:Record<string,[string,number]>={RUN_NOT_FOUND:["Záznam neexistuje.",404],RUN_FORBIDDEN:["Tento záznam nemůžeš upravit.",403],RUN_DELETING:["Záznam se právě maže.",409],INVALID_IMAGES:["Fotografie mají neplatné údaje nebo je jich více než šest.",400]};
    if(known[code])return NextResponse.json({error:known[code][0]},{status:known[code][1]});
    console.error("PATCH /api/runs/update:",error);
    return NextResponse.json({error:"Záznam se nepodařilo upravit."},{status:500});
  }
}
