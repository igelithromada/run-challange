import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeName, normalizeDescription, isChallengeKind, isValidChallengeGoal, isValidDateOnly, normalizeActivityType } from "../../../lib/validation";
import { reconcileChallengesForUser } from "../../../lib/challenges/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const key=(name:string)=>name.trim().toLocaleLowerCase("cs-CZ");

function localDateString() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

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
      const today=localDateString();
      if(startDate<today)return NextResponse.json({error:"Výzvu nelze naplánovat do minulosti."},{status:400});
      const maxStartDate = new Date(`${localDateString()}T12:00:00`);
      maxStartDate.setDate(maxStartDate.getDate()+90);
      const maxStart = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(maxStartDate);
      if(startDate>maxStart)return NextResponse.json({error:"Výzvu lze vytvořit nejvýše 90 dní dopředu."},{status:400});

      const userRef=adminDb.collection("users").doc(uid);
      const challenge=adminDb.collection("challenges").doc();
      const nameRef=adminDb.collection("challengeNames").doc(key(name));
      await adminDb.runTransaction(async tx=>{
        const [userSnap,nameSnap]=await Promise.all([tx.get(userRef),tx.get(nameRef)]);
        if(nameSnap.exists)throw new Error("CHALLENGE_NAME_TAKEN");
        const user=userSnap.exists?userSnap.data()||{}:{};
        if(Number(user.createdChallengeCount||0)>=5)throw new Error("CHALLENGE_CREATE_LIMIT");
        tx.create(nameRef,{challengeId:challenge.id,createdAt:Timestamp.now()});
        tx.create(challenge,{name,nameKey:key(name),description,createdBy:uid,kind,activityType,goal,startDate,endDate,state:startDate===today?"active":"planned",participantCount:1,sharedProgress:0,avatarUrl:typeof body?.avatarUrl==="string"?body.avatarUrl:"",avatarPublicId:typeof body?.avatarPublicId==="string"?body.avatarPublicId:"",createdAt:Timestamp.now()});
        tx.create(challenge.collection("participants").doc(uid),{userId:uid,joinedAt:Timestamp.now(),active:true});
        tx.set(userRef,{createdChallengeCount:FieldValue.increment(1)},{merge:true});
      });
      return NextResponse.json({ok:true,id:challenge.id});
    }

    if(action==="join" || action==="leave"){
      const challengeId=String(body?.challengeId||"");
      if(!challengeId)return NextResponse.json({error:"Chybí výzva."},{status:400});
      const ref=adminDb.collection("challenges").doc(challengeId);
      const member=ref.collection("participants").doc(uid);
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw new Error("CHALLENGE_NOT_FOUND");
        const data=snap.data()||{};
        const today=localDateString();
        if(data.state==="completed")throw new Error("CHALLENGE_LOCKED");
        if(action==="join"){
          const existing=await tx.get(member);
          if(existing.exists && existing.data()?.active===true)return;
          const joinedAt=Timestamp.now();
          tx.set(member,{userId:uid,joinedAt,active:true,leftAt:null,result:0},{merge:true});
          tx.update(ref,{participantCount:FieldValue.increment(1)});
        }else{
          const existing=await tx.get(member);
          if(!existing.exists || existing.data()?.active!==true)return;
          tx.update(member,{active:false,leftAt:Timestamp.now(),result:0});
          tx.update(ref,{participantCount:FieldValue.increment(-1)});
        }
      });
      if(action==="join" || action==="leave") await reconcileChallengesForUser(adminDb,uid);
      return NextResponse.json({ok:true});
    }

    if(action==="delete"){
      const challengeId=String(body?.challengeId||"");
      const ref=adminDb.collection("challenges").doc(challengeId);
      let nameKey="";
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw new Error("CHALLENGE_NOT_FOUND");
        const data=snap.data()||{};
        if(data.createdBy!==uid)throw new Error("NOT_OWNER");
        if(data.state!=="planned")throw new Error("CHALLENGE_LOCKED");
        nameKey=String(data.nameKey||"");
        tx.update(ref,{deleting:true});
      });
      await adminDb.recursiveDelete(ref);
      if(nameKey) await adminDb.collection("challengeNames").doc(nameKey).delete().catch(()=>undefined);
      return NextResponse.json({ok:true});
    }

    if(action==="edit"){
      const challengeId=String(body?.challengeId||"");
      const ref=adminDb.collection("challenges").doc(challengeId);
      const nextName=normalizeName(body?.name), nextDescription=normalizeDescription(body?.description);
      const nextKind=body?.kind, nextType=normalizeActivityType(body?.activityType);
      const nextGoal=Number(body?.goal), nextStart=String(body?.startDate||""), nextEnd=String(body?.endDate||"");
      if(!nextName||!isChallengeKind(nextKind)||!isValidChallengeGoal(nextKind,nextGoal)||!isValidDateOnly(nextStart)||!isValidDateOnly(nextEnd)||nextEnd<nextStart)return NextResponse.json({error:"Výzva má neplatné údaje."},{status:400});
      const today=localDateString();
      if(nextStart<today)return NextResponse.json({error:"Výzvu nelze naplánovat do minulosti."},{status:400});
      const maxStartDate = new Date(`${localDateString()}T12:00:00`);
      maxStartDate.setDate(maxStartDate.getDate()+90);
      const maxStart = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(maxStartDate);
      if(nextStart>maxStart)return NextResponse.json({error:"Výzvu lze vytvořit nejvýše 90 dní dopředu."},{status:400});
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw new Error("CHALLENGE_NOT_FOUND");
        const data=snap.data()||{};
        if(data.createdBy!==uid)throw new Error("NOT_OWNER");
        if(data.state!=="planned")throw new Error("CHALLENGE_LOCKED");
        const newKey=key(nextName), oldKey=data.nameKey;
        if(newKey!==oldKey){
          const nameSnap=await tx.get(adminDb.collection("challengeNames").doc(newKey));
          if(nameSnap.exists)throw new Error("CHALLENGE_NAME_TAKEN");
          tx.delete(adminDb.collection("challengeNames").doc(oldKey));
          tx.create(adminDb.collection("challengeNames").doc(newKey),{challengeId,createdAt:Timestamp.now()});
        }
        tx.update(ref,{name:nextName,nameKey:newKey,description:nextDescription,kind:nextKind,activityType:nextType,goal:nextGoal,startDate:nextStart,endDate:nextEnd,avatarUrl:typeof body?.avatarUrl==="string"?body.avatarUrl:"",avatarPublicId:typeof body?.avatarPublicId==="string"?body.avatarPublicId:""});
      });
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:"Operace výzvy zatím není dostupná."},{status:400});
  }catch(error){
    const m=error instanceof Error?error.message:"";
    const map:any={UNAUTHORIZED:["Nejsi přihlášen.",401],CHALLENGE_NAME_TAKEN:["Výzva s tímto názvem už existuje.",409],CHALLENGE_CREATE_LIMIT:["Můžeš vytvořit nejvýše 5 aktivních nebo plánovaných výzev.",409],CHALLENGE_NOT_FOUND:["Výzva nebyla nalezena.",404],CHALLENGE_LOCKED:["Tato výzva je uzamčená.",409],NOT_OWNER:["Tuto výzvu může upravovat nebo mazat jen její autor.",403]};
    const [msg,status]=map[m]||["Operaci výzvy se nepodařilo dokončit.",500];
    console.error("POST /api/challenges/manage:",error);
    return NextResponse.json({error:msg},{status});
  }
}