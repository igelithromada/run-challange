import { notifyChallengeState } from "../notifications/community";
import { FieldValue, Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";

function pragueDate(value: unknown): string {
  const date = value instanceof Date ? value : value instanceof Timestamp ? value.toDate() : new Date(value as any);
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function inPeriod(date:string,start:string,end:string){return date>=start&&date<=end;}

async function calculateParticipantResult(adminDb:any, challenge:any, participant:any, transaction?:any) {
  const userId=String(participant.userId||"");
  if(!userId)return {result:0,targetReachedAt:null};
  const runsQuery=adminDb.collection("runs").where("uid","==",userId);
  const runsSnap=transaction ? await transaction.get(runsQuery) : await runsQuery.get();
  const joinedAt=participant.joinedAt;
  const joinedMillis=joinedAt?.toMillis ? joinedAt.toMillis() : 0;
  const values=runsSnap.docs.map((d:any)=>({id:d.id,data:d.data()})).filter((item:any)=>{
    const timestamp=item.data.timestamp;
    const millis=timestamp?.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
    return item.data.type === challenge.activityType && Number.isFinite(millis) && millis <= Date.now() && millis>=joinedMillis && inPeriod(pragueDate(timestamp),challenge.startDate,challenge.endDate);
  }).sort((a:any,b:any)=>{
    const ta=a.data.timestamp?.toMillis ? a.data.timestamp.toMillis() : new Date(a.data.timestamp).getTime();
    const tb=b.data.timestamp?.toMillis ? b.data.timestamp.toMillis() : new Date(b.data.timestamp).getTime();
    return ta-tb;
  });
  let result=0,targetReachedAt:any=null;
  const goal=Number(challenge.goal||0);
  if(challenge.kind==="distance"||challenge.kind==="sharedDistance"){
    result=values.reduce((sum:number,item:any)=>sum+Number(item.data.km||0),0);
    if(challenge.kind==="distance"&&result>=goal){
      let sum=0;
      for(const item of values){sum+=Number(item.data.km||0);if(sum>=goal){targetReachedAt=item.data.timestamp;break;}}
    }
  } else if(challenge.kind==="activities"){
    result=values.length;
    if(result>=goal)targetReachedAt=values[goal-1]?.data.timestamp||null;
  } else if(challenge.kind==="activeDays"){
    const days=[...new Set(values.map((item:any)=>pragueDate(item.data.timestamp)))];
    result=days.length;
    if(result>=goal){
      const targetDay=days[goal-1];
      targetReachedAt=values.find((item:any)=>pragueDate(item.data.timestamp)===targetDay)?.data.timestamp||null;
    }
  }
  return {result,targetReachedAt};
}

export async function reconcileChallengesForUser(adminDb:any, userId:string) {
  const today=pragueDate(new Date());
  const lifecycle=await adminDb.collection("challenges").where("state","in",["planned","active"]).get();
  for(const challengeDoc of lifecycle.docs){
    const data=challengeDoc.data()||{};
    if (!data.deleting && ((data.state==="planned" && String(data.startDate||"")<=today) || String(data.endDate||"")<today)) {
      await reconcileChallengeState(adminDb,challengeDoc.id);
    }
  }
  const snapshot=await adminDb.collection("challenges").where("state","==","active").get();
  for(const challengeDoc of snapshot.docs){
    const challenge=challengeDoc.data()||{};
    if(challenge.deleting)continue;
    if(challenge.activityType!=="běh"&&challenge.activityType!=="chůze")continue;
    const recalculate = async (memberId:string) => {
      const memberRef=challengeDoc.ref.collection("participants").doc(memberId);
      await adminDb.runTransaction(async (tx:any) => {
        const [currentChallenge, member]=await Promise.all([tx.get(challengeDoc.ref),tx.get(memberRef)]);
        const current=currentChallenge.data();
        if(!current || current.deleting || current.state!=="active" || member.data()?.active!==true)return;
        // Reading runs inside the transaction prevents an older calculation
        // overwriting a result after an activity or membership changes.
        const calculated=await calculateParticipantResult(adminDb,current,{...member.data(),userId:memberId},tx);
        tx.set(memberRef,calculated,{merge:true});
      });
    };
    if(challenge.kind==="sharedDistance"){
      const members=await challengeDoc.ref.collection("participants").where("active","==",true).get();
      for(const member of members.docs)await recalculate(member.id);
      await adminDb.runTransaction(async (tx:any) => {
        const [currentChallenge,members]=await Promise.all([
          tx.get(challengeDoc.ref),
          tx.get(challengeDoc.ref.collection("participants").where("active","==",true)),
        ]);
        const current=currentChallenge.data();
        if(!current || current.deleting || current.state!=="active")return;
        const shared=members.docs.reduce((sum:number,p:any)=>sum+Number(p.data().result||0),0);
        tx.update(challengeDoc.ref,{sharedProgress:shared,participantCount:members.size});
      });
    }else{
      await recalculate(userId);
    }
  }
}

export async function reconcileChallengeState(adminDb:any, challengeId:string) {
  const ref=adminDb.collection("challenges").doc(challengeId);
  const snap=await ref.get();
  if(!snap.exists)return;
  const challenge=snap.data()||{};
  if(challenge.deleting)return;
  const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(type:string)=>todayParts.find(p=>p.type===type)?.value||"";
  const today=`${get("year")}-${get("month")}-${get("day")}`;

  if((challenge.state==="planned" || challenge.state==="active") && challenge.startDate<=today && challenge.endDate>=today) {
    if(challenge.state==="planned") await ref.update({state:"active",notificationPending:true});
  }

  if((challenge.state==="planned" || challenge.state==="active") && challenge.endDate<today) {
    const participants=await ref.collection("participants").where("active","==",true).get();
    const finalized=await Promise.all(participants.docs.map(async (d: QueryDocumentSnapshot)=>{
      const data=d.data()||{};
      const calculated=await calculateParticipantResult(adminDb,challenge,{...data,userId:d.id});
      return {doc:d, data:{...data,...calculated}};
    }));
    if(challenge.kind==="sharedDistance") {
      const shared=finalized.reduce((sum:number,p:any)=>sum+Number(p.data.result||0),0);
      for(let start=0;start<finalized.length;start+=450){
        const batch=adminDb.batch();
        for(const p of finalized.slice(start,start+450)){
          batch.set(p.doc.ref,{result:Number(p.data.result||0),targetReachedAt:p.data.targetReachedAt||null,finalResult:Number(p.data.result||0),finalizedAt:Timestamp.now()},{merge:true});
        }
        if(start + 450 >= finalized.length) batch.update(ref,{state:"completed",notificationPending:true,completedAt:Timestamp.now(),sharedProgress:shared,goalReached:shared>=Number(challenge.goal||0)});
        await batch.commit();
      }
      if(finalized.length===0) await ref.update({state:"completed",notificationPending:true,completedAt:Timestamp.now(),sharedProgress:0,goalReached:false});
    } else {
      const target=Number(challenge.goal||0);
      const all=finalized.map((p:any)=>({id:p.doc.id,...p.data})).sort((a:any,b:any)=>{
        const diff=Number(b.result||0)-Number(a.result||0);
        if(diff!==0)return diff;
        const ta=a.targetReachedAt?.toMillis ? a.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
        const tb=b.targetReachedAt?.toMillis ? b.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
        if(ta!==tb)return ta-tb;
        return String(a.id).localeCompare(String(b.id));
      });
      const reached=all.filter((p:any)=>Number(p.result||0)>=target);
      const winner=(reached[0]||all[0])?.id||null;
      const finalRanks = new Map<string, number>();
      all.forEach((item:any,index:number)=>finalRanks.set(String(item.id), index + 1));
      for(let start=0;start<all.length;start+=450){
        const batch=adminDb.batch();
        for(const p of all.slice(start,start+450)){
          const original=participants.docs.find((d: any)=>d.id===p.id);
          if(!original)continue;
          const rank = finalRanks.get(String(p.id)) || 0;
          batch.set(original.ref,{result:Number(p.result||0),targetReachedAt:p.targetReachedAt||null,finalResult:Number(p.result||0),finalRank:rank,finalizedAt:Timestamp.now()},{merge:true});
        }
        if(start + 450 >= all.length) batch.update(ref,{state:"completed",notificationPending:true,completedAt:Timestamp.now(),winnerId:winner,goalReached:reached.length>0});
        await batch.commit();
      }
      if(all.length===0) await ref.update({state:"completed",notificationPending:true,completedAt:Timestamp.now(),winnerId:null,goalReached:false});
    }
  }
  await notifyChallengeState(adminDb, challengeId);
}
