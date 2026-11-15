import { FieldValue, Timestamp } from "firebase-admin/firestore";

function pragueDate(value: unknown): string {
  const date = value instanceof Date ? value : value instanceof Timestamp ? value.toDate() : new Date(value as any);
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function inPeriod(date:string,start:string,end:string){return date>=start&&date<=end;}

async function calculateParticipantResult(adminDb:any, challenge:any, participant:any) {
  const userId=String(participant.userId||"");
  if(!userId)return {result:0,targetReachedAt:null};
  const runsSnap=await adminDb.collection("runs")
    .where("uid","==",userId)
    .where("type","==",challenge.activityType)
    .get();
  const joinedAt=participant.joinedAt;
  const joinedMillis=joinedAt?.toMillis ? joinedAt.toMillis() : 0;
  const values=runsSnap.docs.map((d:any)=>({id:d.id,data:d.data()})).filter((item:any)=>{
    const timestamp=item.data.timestamp;
    const millis=timestamp?.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
    return millis>=joinedMillis && inPeriod(pragueDate(timestamp),challenge.startDate,challenge.endDate);
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
  const snapshot=await adminDb.collection("challenges").where("state","==","active").get();
  for(const challengeDoc of snapshot.docs){
    const challenge=challengeDoc.data()||{};
    if(challenge.activityType!=="běh"&&challenge.activityType!=="chůze")continue;
    const participantRef=challengeDoc.ref.collection("participants").doc(userId);
    const participant=await participantRef.get();
    if(!participant.exists||participant.data()?.active!==true){
      if(challenge.kind==="sharedDistance"){
        const activeParticipants=await challengeDoc.ref.collection("participants").where("active","==",true).get();
        let shared=0;
        const batch=adminDb.batch();
        for(const p of activeParticipants.docs){
          const pd=p.data()||{};
          const calculated=await calculateParticipantResult(adminDb,challenge,{...pd,userId:p.id});
          shared+=Number(calculated.result||0);
          batch.set(p.ref,calculated,{merge:true});
        }
        batch.update(challengeDoc.ref,{sharedProgress:shared});
        await batch.commit();
      }
      continue;
    }
    const result=await calculateParticipantResult(adminDb,challenge,{...participant.data(),userId});
    await participantRef.set(result,{merge:true});
    if(challenge.kind==="sharedDistance"){
      const participants=await challengeDoc.ref.collection("participants").where("active","==",true).get();
      const batch=adminDb.batch(); let shared=0;
      for(const p of participants.docs){
        const pd=p.data()||{};
        const calculated=p.id===userId?result:await calculateParticipantResult(adminDb,challenge,{...pd,userId:p.id});
        shared+=Number(calculated.result||0);
        batch.set(p.ref,calculated,{merge:true});
      }
      batch.update(challengeDoc.ref,{sharedProgress:shared});
      await batch.commit();
    }
  }
}

export async function reconcileChallengeState(adminDb:any, challengeId:string) {
  const ref=adminDb.collection("challenges").doc(challengeId);
  const snap=await ref.get();
  if(!snap.exists)return;
  const challenge=snap.data()||{};
  const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(type:string)=>todayParts.find(p=>p.type===type)?.value||"";
  const today=`${get("year")}-${get("month")}-${get("day")}`;

  if((challenge.state==="planned" || challenge.state==="active") && challenge.startDate===today) {
    const participants=await ref.collection("participants").where("active","==",true).get();
    if(participants.size<=1) {
      await adminDb.recursiveDelete(ref);
      await adminDb.collection("challengeNames").doc(String(challenge.nameKey||"")).delete().catch(()=>undefined);
      return;
    }
    if(challenge.state==="planned") await ref.update({state:"active"});
  }

  if((challenge.state==="planned" || challenge.state==="active") && challenge.endDate<today) {
    const participants=await ref.collection("participants").where("active","==",true).get();
    if(challenge.kind==="sharedDistance") {
      const shared=participants.docs.reduce((sum:number,d:any)=>sum+Number(d.data()?.result||0),0);
      const batch=adminDb.batch();
      for (const participant of participants.docs) {
        const data=participant.data()||{};
        batch.set(participant.ref,{finalResult:Number(data.result||0),finalizedAt:Timestamp.now()},{merge:true});
      }
      batch.update(ref,{state:"completed",completedAt:Timestamp.now(),sharedProgress:shared,goalReached:shared>=Number(challenge.goal||0)});
      await batch.commit();
    } else {
      const target=Number(challenge.goal||0);
      const reached=participants.docs.map((d:any)=>({id:d.id,...d.data()}))
        .filter((p:any)=>Number(p.result||0)>=target)
        .sort((a:any,b:any)=>{
          const ta=a.targetReachedAt?.toMillis ? a.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
          const tb=b.targetReachedAt?.toMillis ? b.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
          if(ta!==tb)return ta-tb;
          return Number(b.result||0)-Number(a.result||0);
        });
      const all=participants.docs.map((d:any)=>({id:d.id,...d.data()})).sort((a:any,b:any)=>{
        const diff=Number(b.result||0)-Number(a.result||0);
        if(diff!==0)return diff;
        const ta=a.targetReachedAt?.toMillis ? a.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
        const tb=b.targetReachedAt?.toMillis ? b.targetReachedAt.toMillis() : Number.MAX_SAFE_INTEGER;
        return ta-tb;
      });
      const winner=(reached[0]||all[0])?.id||null;
      const rankOrdered=all;
      const batch=adminDb.batch();
      rankOrdered.forEach((participant:any,index:number)=>{
        batch.set(participants.docs.find((d:any)=>d.id===participant.id).ref,{
          finalResult:Number(participant.result||0),
          finalRank:index+1,
          finalizedAt:Timestamp.now()
        },{merge:true});
      });
      batch.update(ref,{state:"completed",completedAt:Timestamp.now(),winnerId:winner,goalReached:reached.length>0});
      await batch.commit();
    }
  }
}
