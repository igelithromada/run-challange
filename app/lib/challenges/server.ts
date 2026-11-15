import { FieldValue, Timestamp } from "firebase-admin/firestore";

function pragueDate(value: unknown): string {
  const date = value instanceof Date ? value : value instanceof Timestamp ? value.toDate() : new Date(value as any);
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function inPeriod(date:string,start:string,end:string){return date>=start&&date<=end;}

export async function reconcileChallengesForUser(adminDb:any, userId:string) {
  const snapshot = await adminDb.collection("challenges")
    .where("state","==","active")
    .get();

  for (const challengeDoc of snapshot.docs) {
    const challenge=challengeDoc.data()||{};
    if (challenge.activityType !== "běh" && challenge.activityType !== "chůze") continue;

    const participantRef=challengeDoc.ref.collection("participants").doc(userId);
    const participant=await participantRef.get();
    if(!participant.exists || participant.data()?.active!==true) continue;

    const runsSnap=await adminDb.collection("runs")
      .where("uid","==",userId)
      .where("type","==",challenge.activityType)
      .get();

    const joinedAt=participant.data()?.joinedAt;
    const joinedMillis=joinedAt?.toMillis ? joinedAt.toMillis() : 0;
    const values=runsSnap.docs.map((d:any)=>({id:d.id,data:d.data()})).filter((item:any)=>{
      const data=item.data;
      const timestamp=data.timestamp;
      const millis=timestamp?.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
      const day=pragueDate(timestamp);
      return millis>=joinedMillis && inPeriod(day,challenge.startDate,challenge.endDate);
    }).sort((a:any,b:any)=>{
      const ta=a.data.timestamp?.toMillis ? a.data.timestamp.toMillis() : new Date(a.data.timestamp).getTime();
      const tb=b.data.timestamp?.toMillis ? b.data.timestamp.toMillis() : new Date(b.data.timestamp).getTime();
      return ta-tb;
    });

    let result=0;
    let targetReachedAt:any=null;
    if(challenge.kind==="sharedDistance") {
      result=values.reduce((sum:any,item:any)=>sum+Number(item.data.km||0),0);
    } else if(challenge.kind==="distance") {
      result=values.reduce((sum:any,item:any)=>sum+Number(item.data.km||0),0);
      if(result>=Number(challenge.goal||0)){
        let sum=0;
        for(const item of values){sum+=Number(item.data.km||0);if(sum>=Number(challenge.goal||0)){targetReachedAt=item.data.timestamp;break;}}
      }
    } else if(challenge.kind==="activities") {
      result=values.length;
      if(result>=Number(challenge.goal||0)) targetReachedAt=values[Number(challenge.goal)-1]?.data.timestamp||null;
    } else if(challenge.kind==="activeDays") {
      const days=[...new Set(values.map((item:any)=>pragueDate(item.data.timestamp)))];
      result=days.length;
      if(result>=Number(challenge.goal||0)){
        const targetDay=days[Number(challenge.goal)-1];
        targetReachedAt=values.find((item:any)=>pragueDate(item.data.timestamp)===targetDay)?.data.timestamp||null;
      }
    }

    await participantRef.set({result,targetReachedAt:targetReachedAt||null},{merge:true});
    if(challenge.kind==="sharedDistance") {
      const participants=await challengeDoc.ref.collection("participants").where("active","==",true).get();
      const shared=participants.docs.reduce((sum:number,d:any)=>sum+Number(d.data()?.result||0),0);
      await challengeDoc.ref.set({sharedProgress:shared},{merge:true});
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

  if(challenge.state==="planned" && challenge.startDate===today) {
    const participants=await ref.collection("participants").where("active","==",true).get();
    if(participants.size<=1) {
      await ref.update({state:"completed",autoCancelled:true,completedAt:Timestamp.now()});
      return;
    }
    await ref.update({state:"active"});
  }

  if((challenge.state==="planned" || challenge.state==="active") && challenge.endDate<today) {
    const participants=await ref.collection("participants").where("active","==",true).get();
    if(challenge.kind==="sharedDistance") {
      const shared=participants.docs.reduce((sum:number,d:any)=>sum+Number(d.data()?.result||0),0);
      await ref.update({state:"completed",completedAt:Timestamp.now(),sharedProgress:shared});
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
      const all=participants.docs.map((d:any)=>({id:d.id,...d.data()})).sort((a:any,b:any)=>Number(b.result||0)-Number(a.result||0));
      await ref.update({state:"completed",completedAt:Timestamp.now(),winnerId:(reached[0]||all[0])?.id||null,goalReached:reached.length>0});
    }
  }
}
