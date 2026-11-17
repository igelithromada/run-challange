import { challengeKindFor } from "../../../lib/challengeMeasurement";
import { prepareCommunityNotification } from "../../../lib/notifications/community";
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeName, normalizeDescription, isChallengeKind, isValidChallengeGoal, isValidDateOnly, normalizeActivityType, isActivityType } from "../../../lib/validation";
import { reconcileChallengesForUser } from "../../../lib/challenges/server";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const key=(name:string)=>{
  const value=name.trim().toLocaleLowerCase("cs-CZ").replace(/%/g,"%25").replace(/\//g,"%2F");
  return value==="." || value===".." ? value.replace(/\./g,"%2E") : value;
};
const startMonth=(date:string)=>date.slice(0,7);
function challengeImage(body:any, uid:string) {
  const avatarUrl=typeof body?.avatarUrl==="string"?body.avatarUrl.trim():"";
  const avatarPublicId=typeof body?.avatarPublicId==="string"?body.avatarPublicId.trim():"";
  if (!avatarUrl && !avatarPublicId) return { avatarUrl:"", avatarPublicId:"" };
  const parsedId=cloudinaryPublicIdFromUrl(avatarUrl);
  if (!avatarUrl.startsWith("https://res.cloudinary.com/") || !avatarPublicId || !isUserCloudinaryPublicId(avatarPublicId,uid) || !parsedId || parsedId!==avatarPublicId) throw new Error("INVALID_CHALLENGE_IMAGE");
  return { avatarUrl, avatarPublicId };
}

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

    if(action==="refresh"){
      await reconcileChallengesForUser(adminDb,uid);
      return NextResponse.json({ok:true});
    }

    if(action==="create"){
      const name=normalizeName(body?.name), description=normalizeDescription(body?.description);
      const kind=body?.kind, activityType=normalizeActivityType(body?.activityType);
      const goal=Number(body?.goal), startDate=String(body?.startDate||""), endDate=String(body?.endDate||"");
      const image=challengeImage(body,uid);
      if(!name)return NextResponse.json({error:"Zadej název výzvy."},{status:400});
      if(!isActivityType(body?.activityType)||!isChallengeKind(kind)||challengeKindFor(activityType,kind)!==kind||!isValidChallengeGoal(kind,goal))return NextResponse.json({error:"Výzva má neplatný typ nebo cíl."},{status:400});
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
        const existingSnap=await tx.get(adminDb.collection("challenges").where("createdBy","==",uid));
        const activeOrPlannedCount=existingSnap.docs.filter(d=>{
          const state=d.data()?.state;
          return !d.data()?.deleting && (state==="planned" || state==="active") && String(d.data()?.endDate || "") >= today;
        }).length;
        if(activeOrPlannedCount>=5)throw new Error("CHALLENGE_CREATE_LIMIT");
        tx.set(userRef,{challengeCreatedAt:Timestamp.now()},{merge:true});
        tx.create(nameRef,{challengeId:challenge.id,createdAt:Timestamp.now()});
        tx.create(challenge,{name,nameKey:key(name),description,createdBy:uid,kind,activityType,goal,startDate,endDate,startMonth:startMonth(startDate),state:startDate===today?"active":"planned",participantCount:1,sharedProgress:0,avatarUrl:image.avatarUrl,avatarPublicId:image.avatarPublicId,createdAt:Timestamp.now()});
        tx.create(challenge.collection("participants").doc(uid),{userId:uid,joinedAt:Timestamp.now(),active:true});
              });
      try { await reconcileChallengesForUser(adminDb, uid); }
      catch (error) { console.error("Challenge reconciliation after create failed:", error); }
      return NextResponse.json({
        ok:true,
        id:challenge.id,
        challenge:{
          id:challenge.id,name,description,createdBy:uid,kind,activityType,goal,startDate,endDate,
          startMonth:startMonth(startDate),state:startDate===today?"active":"planned",
          participantCount:1,sharedProgress:0,avatarUrl:image.avatarUrl,avatarPublicId:image.avatarPublicId
        }
      });
    }

    if(action==="join" || action==="leave"){
      const challengeId=String(body?.challengeId||"");
      if(!challengeId)return NextResponse.json({error:"Chybí výzva."},{status:400});
      if(!challengeId || challengeId.includes("/"))return NextResponse.json({error:"Chybí platné ID výzvy."},{status:400});
      const ref=adminDb.collection("challenges").doc(challengeId);
      const member=ref.collection("participants").doc(uid);
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw new Error("CHALLENGE_NOT_FOUND");
        const data=snap.data()||{};
        const today=localDateString();
        if(data.deleting || data.state==="completed" || String(data.endDate||"") < today)throw new Error("CHALLENGE_LOCKED");
        if(action==="join"){
          const existing=await tx.get(member);
          if(existing.exists && existing.data()?.active===true)return;
          const notification = await prepareCommunityNotification(adminDb, tx, {
            recipientUid: String(data.createdBy || ""), actorUid: uid, category: "challenges", challengeId,
            title: "Nový účastník výzvy", body: `{actor} se přidal do výzvy „${data.name}“.`,
          });
          const joinedAt=Timestamp.now();
          if (notification) tx.create(adminDb.collection("notifications").doc(), notification);
          tx.set(member,{userId:uid,joinedAt,active:true,leftAt:null,result:0,stateNotified:{active:data.state==="active"}},{merge:true});
          tx.update(ref,{participantCount:FieldValue.increment(1)});
        }else{
          const existing=await tx.get(member);
          if(!existing.exists || existing.data()?.active!==true)return;
          const notification = await prepareCommunityNotification(adminDb, tx, {
            recipientUid: String(data.createdBy || ""), actorUid: uid, category: "challenges", challengeId,
            title: "Účastník opustil výzvu", body: `{actor} opustil výzvu „${data.name}“.`,
          });
          if (notification) tx.create(adminDb.collection("notifications").doc(), notification);
          tx.update(member,{active:false,leftAt:Timestamp.now(),result:0});
          tx.update(ref,{participantCount:FieldValue.increment(-1)});
        }
      });
      try { await reconcileChallengesForUser(adminDb,uid); }
      catch (error) { console.error("Challenge reconciliation after membership change failed:", error); }
      return NextResponse.json({ok:true});
    }

    if(action==="delete"){
      const challengeId=String(body?.challengeId||"");
      if(!challengeId || challengeId.includes("/"))return NextResponse.json({error:"Chybí platné ID výzvy."},{status:400});
      const ref=adminDb.collection("challenges").doc(challengeId);
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw new Error("CHALLENGE_NOT_FOUND");
        const data=snap.data()||{};
        if(data.createdBy!==uid)throw new Error("NOT_OWNER");
        if(data.state!=="planned" || String(data.startDate||"")<=localDateString())throw new Error("CHALLENGE_LOCKED");
        const nameKey=String(data.nameKey||"");
        const nameRef=nameKey ? adminDb.collection("challengeNames").doc(nameKey) : null;
        const nameSnap=nameRef ? await tx.get(nameRef) : null;
        tx.update(ref,{deleting:true});
        if(nameRef && nameSnap?.data()?.challengeId===challengeId) tx.delete(nameRef);
      });
      await adminDb.recursiveDelete(ref);
      return NextResponse.json({ok:true});
    }

    if(action==="edit"){
      const challengeId=String(body?.challengeId||"");
      if(!challengeId || challengeId.includes("/"))return NextResponse.json({error:"Chybí platné ID výzvy."},{status:400});
      const ref=adminDb.collection("challenges").doc(challengeId);
      const nextName=normalizeName(body?.name), nextDescription=normalizeDescription(body?.description);
      const nextKind=body?.kind, nextType=normalizeActivityType(body?.activityType);
      const nextGoal=Number(body?.goal), nextStart=String(body?.startDate||""), nextEnd=String(body?.endDate||"");
      const image=challengeImage(body,uid);
      if(!nextName||!isActivityType(body?.activityType)||!isChallengeKind(nextKind)||challengeKindFor(nextType,nextKind)!==nextKind||!isValidChallengeGoal(nextKind,nextGoal)||!isValidDateOnly(nextStart)||!isValidDateOnly(nextEnd)||nextEnd<nextStart)return NextResponse.json({error:"Výzva má neplatné údaje."},{status:400});
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
        if(data.deleting || data.state!=="planned" || String(data.startDate||"")<=localDateString())throw new Error("CHALLENGE_LOCKED");
        const newKey=key(nextName), oldKey=data.nameKey;
        if(newKey!==oldKey){
          const nameSnap=await tx.get(adminDb.collection("challengeNames").doc(newKey));
          if(nameSnap.exists)throw new Error("CHALLENGE_NAME_TAKEN");
          if(oldKey) tx.delete(adminDb.collection("challengeNames").doc(oldKey));
          tx.create(adminDb.collection("challengeNames").doc(newKey),{challengeId,createdAt:Timestamp.now()});
        }
        tx.update(ref,{state:nextStart===today?"active":"planned",name:nextName,nameKey:newKey,description:nextDescription,kind:nextKind,activityType:nextType,goal:nextGoal,startDate:nextStart,endDate:nextEnd,startMonth:startMonth(nextStart),avatarUrl:image.avatarUrl,avatarPublicId:image.avatarPublicId});
      });
      try { await reconcileChallengesForUser(adminDb,uid); }
      catch(error) { console.error("Challenge reconciliation after edit failed:",error); }
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:"Operace výzvy zatím není dostupná."},{status:400});
  }catch(error){
    const m=error instanceof Error?error.message:"";
    const map:any={UNAUTHORIZED:["Nejsi přihlášen.",401],CHALLENGE_NAME_TAKEN:["Výzva s tímto názvem už existuje.",409],CHALLENGE_CREATE_LIMIT:["Můžeš vytvořit nejvýše 5 aktivních nebo plánovaných výzev.",409],CHALLENGE_NOT_FOUND:["Výzva nebyla nalezena.",404],CHALLENGE_LOCKED:["Tato výzva je uzamčená.",409],INVALID_CHALLENGE_IMAGE:["Obrázek výzvy není platný.",400],NOT_OWNER:["Tuto výzvu může upravovat nebo mazat jen její autor.",403]};
    const [msg,status]=map[m]||["Operaci výzvy se nepodařilo dokončit.",500];
    console.error("POST /api/challenges/manage:",error);
    return NextResponse.json({error:msg},{status});
  }
}