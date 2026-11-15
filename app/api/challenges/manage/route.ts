import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeName, normalizeDescription, isChallengeKind, isValidChallengeGoal, isValidDateOnly, normalizeActivityType } from "../../../lib/validation";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const key=(name:string)=>name.trim().toLocaleLowerCase("cs-CZ");

export async function POST(request:Request){
  try{
    const {decoded,adminDb}=await requireUser(request);
    const body=await request.json().catch(()=>({}));
    const action=String(body?.action||"");
    const uid=decoded.uid;

    if(action==="create"){
      const name=normalizeName(body?.name), description=normalizeDescription(body?.description);
      const kind=body?.kind, activityType=normalizeActivityType(body?.activityType);
      const goal=Number(body?.goal), startDate=String(body?.startDate||""), endDate=String(body?.endDate||"");
      if(!name)return NextResponse.json({error:"Zadej název výzvy."},{status:400});
      if(!isChallengeKind(kind)||!isValidChallengeGoal(kind,goal))return NextResponse.json({error:"Výzva má neplatný typ nebo cíl."},{status:400});
      if(!isValidDateOnly(startDate)||!isValidDateOnly(endDate)||endDate<startDate)return NextResponse.json({error:"Zadej platné datumy výzvy."},{status:400});
      const today=new Date().toISOString().slice(0,10);
      if(startDate<today)return NextResponse.json({error:"Výzvu nelze naplánovat do minulosti."},{status:400});
      const maxStart=new Date(); maxStart.setDate(maxStart.getDate()+90);
      if(startDate>maxStart.toISOString().slice(0,10))return NextResponse.json({error:"Výzvu lze vytvořit nejvýše 90 dní dopředu."},{status:400});

      const userRef=adminDb.collection("users").doc(uid);
      const challenge=adminDb.collection("challenges").doc();
      const nameRef=adminDb.collection("challengeNames").doc(key(name));
      await adminDb.runTransaction(async tx=>{
        const [userSnap,nameSnap]=await Promise.all([tx.get(userRef),tx.get(nameRef)]);
        if(nameSnap.exists)throw new Error("CHALLENGE_NAME_TAKEN");
        const user=userSnap.exists?userSnap.data()||{}:{};
        if(Number(user.createdChallengeCount||0)>=5)throw new Error("CHALLENGE_CREATE_LIMIT");
        tx.create(nameRef,{challengeId:challenge.id,createdAt:Timestamp.now()});
        tx.create(challenge,{name,nameKey:key(name),description,createdBy:uid,kind,activityType,goal,startDate,endDate,state:startDate===today?"active":"planned",participantCount:1,sharedProgress:0,createdAt:Timestamp.now()});
        tx.create(challenge.collection("participants").doc(uid),{userId:uid,joinedAt:Timestamp.now(),active:true});
        tx.set(userRef,{createdChallengeCount:FieldValue.increment(1)},{merge:true});
      });
      return NextResponse.json({ok:true,id:challenge.id});
    }

    return NextResponse.json({error:"Operace výzvy zatím není dostupná."},{status:400});
  }catch(error){
    const m=error instanceof Error?error.message:"";
    const map:any={UNAUTHORIZED:["Nejsi přihlášen.",401],CHALLENGE_NAME_TAKEN:["Výzva s tímto názvem už existuje.",409],CHALLENGE_CREATE_LIMIT:["Můžeš vytvořit nejvýše 5 aktivních nebo plánovaných výzev.",409]};
    const [msg,status]=map[m]||["Operaci výzvy se nepodařilo dokončit.",500];
    console.error("POST /api/challenges/manage:",error);
    return NextResponse.json({error:msg},{status});
  }
}