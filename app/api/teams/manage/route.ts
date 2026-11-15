import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireUser } from "../../../lib/apiAuth";
import { normalizeTeamName, normalizeDescription } from "../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teamRef = (db:any,id:string) => db.collection("teams").doc(id);
const memberRef = (db:any,teamId:string,uid:string) => teamRef(db,teamId).collection("members").doc(uid);
const normalizeKey = (name:string) => name.trim().toLocaleLowerCase("cs-CZ");

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const uid = decoded.uid;

    if (action === "create") {
      const name = normalizeTeamName(body?.name), description = normalizeDescription(body?.description);
      if (!name) return NextResponse.json({ error:"Zadej název týmu." }, {status:400});
      const nameKey = normalizeKey(name);
      const userRef = adminDb.collection("users").doc(uid);
      const team = adminDb.collection("teams").doc();
      const nameRef = adminDb.collection("teamNames").doc(nameKey);

      await adminDb.runTransaction(async tx => {
        const [userSnap,nameSnap] = await Promise.all([tx.get(userRef),tx.get(nameRef)]);
        if (nameSnap.exists) throw new Error("TEAM_NAME_TAKEN");
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const createdCount = Number(userData.createdTeamCount || 0);
        if (createdCount >= 5) throw new Error("TEAM_CREATE_LIMIT");
        tx.create(nameRef,{teamId:team.id,createdAt:Timestamp.now()});
        tx.create(team,{
          name,nameKey,description,createdBy:uid,managerId:uid,avatarUrl:"",avatarPublicId:"",
          memberCount:1,stats:{runningKm:0,runningActivities:0,walkingKm:0,walkingActivities:0},createdAt:Timestamp.now()
        });
        tx.create(memberRef(adminDb,team.id,uid),{userId:uid,joinedAt:Timestamp.now(),active:true});
        tx.set(userRef,{createdTeamCount:FieldValue.increment(1)},{merge:true});
      });
      return NextResponse.json({ok:true,team:{id:team.id,name,description}});
    }

    const teamId = String(body?.teamId || "");
    if (!teamId) return NextResponse.json({error:"Chybí tým."},{status:400});
    const ref = teamRef(adminDb,teamId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({error:"Tým neexistuje."},{status:404});
    const team = snap.data() || {};

    if (action === "join") {
      await adminDb.runTransaction(async tx => {
        const m = await tx.get(memberRef(adminDb,teamId,uid));
        if (m.exists && m.data()?.active !== false) return;
        const now=Timestamp.now();
        tx.set(memberRef(adminDb,teamId,uid),{userId:uid,joinedAt:now,active:true,leaveAt:null},{merge:true});
        const historyRef=ref.collection("membershipHistory").doc();
        tx.create(historyRef,{userId:uid,joinedAt:now,active:true});
        tx.update(ref,{memberCount:FieldValue.increment(1)});
      });
      return NextResponse.json({ok:true});
    }

    if (action === "leave") {
      if (team.managerId === uid) return NextResponse.json({error:"Nejdřív předej správu týmu jinému členovi."},{status:409});
      await adminDb.runTransaction(async tx => {
        const m=await tx.get(memberRef(adminDb,teamId,uid));
        if (!m.exists || m.data()?.active === false) return;
        const now=Timestamp.now();
        tx.set(memberRef(adminDb,teamId,uid),{active:false,leaveAt:now},{merge:true});
        const history=await tx.get(ref.collection("membershipHistory").where("userId","==",uid).where("active","==",true).limit(1));
        history.docs.forEach((d:any)=>tx.update(d.ref,{active:false,leaveAt:now}));
        tx.update(ref,{memberCount:FieldValue.increment(-1)});
      });
      return NextResponse.json({ok:true});
    }

    if (action === "rename" || action === "edit") {
      if (team.managerId !== uid) return NextResponse.json({error:"Tým může upravovat jen jeho správce."},{status:403});
      const updates:any={};
      if (action === "rename" || body.name !== undefined) {
        const name=normalizeTeamName(body?.name);
        if(!name) return NextResponse.json({error:"Zadej název týmu."},{status:400});
        const nameKey=normalizeKey(name);
        if(nameKey!==team.nameKey){
          const oldNameRef=adminDb.collection("teamNames").doc(String(team.nameKey||""));
          const newNameRef=adminDb.collection("teamNames").doc(nameKey);
          await adminDb.runTransaction(async tx=>{
            const existing=await tx.get(newNameRef);
            if(existing.exists) throw new Error("TEAM_NAME_TAKEN");
            tx.delete(oldNameRef); tx.create(newNameRef,{teamId,createdAt:team.createdAt||Timestamp.now()});
            tx.update(ref,{name,nameKey});
          });
        } else await ref.set({name},{merge:true});
      }
      if(body.description!==undefined) updates.description=normalizeDescription(body.description);
      if(body.avatarUrl!==undefined) updates.avatarUrl=typeof body.avatarUrl==="string"?body.avatarUrl:"";
      if(body.avatarPublicId!==undefined) updates.avatarPublicId=typeof body.avatarPublicId==="string"?body.avatarPublicId:"";
      if(Object.keys(updates).length) await ref.set(updates,{merge:true});
      return NextResponse.json({ok:true});
    }

    if (action === "transfer") {
      const newManagerId=String(body?.newManagerId||"");
      if(team.managerId!==uid) return NextResponse.json({error:"Správu může převést jen současný správce."},{status:403});
      if(!newManagerId || newManagerId===uid) return NextResponse.json({error:"Vyber jiného člena týmu."},{status:400});
      const target=await memberRef(adminDb,teamId,newManagerId).get();
      if(!target.exists || target.data()?.active===false) return NextResponse.json({error:"Nový správce musí být členem týmu."},{status:400});
      await adminDb.runTransaction(async tx=>{
        const teamSnap=await tx.get(ref);
        const targetSnap=await tx.get(memberRef(adminDb,teamId,newManagerId));
        if(!teamSnap.exists || teamSnap.data()?.managerId!==uid) throw new Error("NOT_MANAGER");
        if(!targetSnap.exists || targetSnap.data()?.active===false) throw new Error("TARGET_NOT_MEMBER");
        tx.update(ref,{managerId:newManagerId});
      });
      return NextResponse.json({ok:true});
    }

    if (action === "delete") {
      if(team.managerId!==uid) return NextResponse.json({error:"Tým může smazat jen jeho správce."},{status:403});
      const membersSnap=await ref.collection("members").get();
      const batch=adminDb.batch();
      membersSnap.docs.forEach((d:any)=>batch.delete(d.ref));
      batch.delete(ref);
      if(team.nameKey) batch.delete(adminDb.collection("teamNames").doc(team.nameKey));
      await batch.commit();
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:"Neznámá operace."},{status:400});
  } catch(error) {
    const message=error instanceof Error?error.message:"";
    const map:any={
      UNAUTHORIZED:["Nejsi přihlášen.",401],TEAM_NAME_TAKEN:["Tým s tímto názvem už existuje.",409],
      TEAM_CREATE_LIMIT:["Můžeš vytvořit nejvýše 5 týmů.",409],
      NOT_MANAGER:["Správu může převést jen současný správce.",403],
      TARGET_NOT_MEMBER:["Nový správce musí být členem týmu.",400]
    };
    const [text,status]=map[message]||["Operaci týmu se nepodařilo dokončit.",500];
    console.error("POST /api/teams/manage:",error);
    return NextResponse.json({error:text},{status});
  }
}