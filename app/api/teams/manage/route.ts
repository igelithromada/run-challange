import { NextResponse } from "next/server";
import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { requireUser, authErrorResponse } from "../../../lib/apiAuth";
import { normalizeTeamName, normalizeDescription } from "../../../lib/validation";
import { cloudinaryPublicIdFromUrl, isUserCloudinaryPublicId } from "../../../lib/cloudinaryAdmin";

import { getActiveTeamMemberships } from "../../../lib/teams/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const teamRef = (db:any,id:string): DocumentReference => db.collection("teams").doc(id);
const memberRef = (db:any,teamId:string,uid:string): DocumentReference => teamRef(db,teamId).collection("members").doc(uid);
const normalizeKey = (name:string) => name.trim().toLocaleLowerCase("cs-CZ").replace(/%/g,"%25").replace(/\//g,"%2F").replace(/^\.{1,2}$/, value => value.replace(/\./g,"%2E"));
function teamImage(body:any, uid:string) {
  const avatarUrl=typeof body?.avatarUrl==="string"?body.avatarUrl.trim():"";
  const avatarPublicId=typeof body?.avatarPublicId==="string"?body.avatarPublicId.trim():"";
  if (!avatarUrl && !avatarPublicId) return {avatarUrl:"",avatarPublicId:""};
  const parsed=cloudinaryPublicIdFromUrl(avatarUrl);
  if (!avatarUrl.startsWith("https://res.cloudinary.com/") || !avatarPublicId || !isUserCloudinaryPublicId(avatarPublicId,uid) || parsed!==avatarPublicId) throw new Error("INVALID_TEAM_IMAGE");
  return {avatarUrl,avatarPublicId};
}

export async function POST(request: Request) {
  try {
    const { decoded, adminDb } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const uid = decoded.uid;

    if (action === "create") {
      const name = normalizeTeamName(body?.name), description = normalizeDescription(body?.description);
      const image = teamImage(body, uid);
      if (!name) return NextResponse.json({ error:"Zadej název týmu." }, {status:400});
      const nameKey = normalizeKey(name);
      const userRef = adminDb.collection("users").doc(uid);
      const team = adminDb.collection("teams").doc();
      const nameRef = adminDb.collection("teamNames").doc(nameKey);

      await adminDb.runTransaction(async tx => {
        const [userSnap,nameSnap] = await Promise.all([tx.get(userRef),tx.get(nameRef)]);
        if (nameSnap.exists) throw new Error("TEAM_NAME_TAKEN");
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const createdTeams = await tx.get(adminDb.collection("teams").where("createdBy", "==", uid));
        const createdCount = createdTeams.docs.filter(team => !team.data().deleting).length;
        if (createdCount >= 5) throw new Error("TEAM_CREATE_LIMIT");
        tx.create(nameRef,{teamId:team.id,createdAt:Timestamp.now()});
        tx.create(team,{
          name,nameKey,description,createdBy:uid,managerId:uid,avatarUrl:image.avatarUrl,avatarPublicId:image.avatarPublicId,
          memberCount:1,stats:{runningKm:0,runningActivities:0,walkingKm:0,walkingActivities:0},createdAt:Timestamp.now()
        });
        const joinedAt=Timestamp.now();
        tx.create(memberRef(adminDb,team.id,uid),{userId:uid,joinedAt,active:true});
        tx.create(team.collection("membershipHistory").doc(),{userId:uid,joinedAt,active:true});
        tx.set(userRef,{createdTeamCount:createdCount+1},{merge:true});
      });
      return NextResponse.json({ok:true,team:{id:team.id,name,description}});
    }

    if (action === "listMine") {
      const pageSize = Math.min(10, Math.max(1, Number(body?.pageSize) || 10));
      const page = Math.max(1, Number(body?.page) || 1);
      const ids = await getActiveTeamMemberships(adminDb,uid);
      const teamSnapshots = await Promise.all(ids.map((id: string) => adminDb.collection("teams").doc(id).get()));
      const items = teamSnapshots
        .filter((snap: any) => snap.exists)
        .map((snap: any) => ({ id: snap.id, ...snap.data() }))
        .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), "cs"));
      const start = (page - 1) * pageSize;
      return NextResponse.json({ ok: true, items: items.slice(start, start + pageSize), hasMore: start + pageSize < items.length });
    }

    const teamId = String(body?.teamId || "");
    if (!teamId || teamId.includes("/")) return NextResponse.json({error:"Chybí tým."},{status:400});
    const ref = teamRef(adminDb,teamId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({error:"Tým neexistuje."},{status:404});
    const team = snap.data() || {};
    if(team.deleting && action!=="delete")throw new Error("TEAM_NOT_FOUND");

    if (action === "join") {
      await adminDb.runTransaction(async tx => {
        const teamSnap = await tx.get(ref);
        if (!teamSnap.exists || teamSnap.data()?.deleting) throw new Error("TEAM_NOT_FOUND");
        const currentTeam = teamSnap.data() || {};
        const m = await tx.get(memberRef(adminDb,teamId,uid));
        if (m.exists && m.data()?.active !== false) return;
        const now = Timestamp.now();
        tx.set(memberRef(adminDb,teamId,uid),{userId:uid,joinedAt:now,active:true,leaveAt:null},{merge:true});
        const historyRef=ref.collection("membershipHistory").doc();
        tx.create(historyRef,{userId:uid,joinedAt:now,active:true});
        tx.update(ref,{
          memberCount:FieldValue.increment(1),
          ...(currentTeam.managerId ? {} : {managerId:uid})
        });
      });
      return NextResponse.json({ok:true});
    }

    if (action === "leave") {
      await adminDb.runTransaction(async tx => {
        const teamSnap = await tx.get(ref);
        const m = await tx.get(memberRef(adminDb,teamId,uid));
        if (!teamSnap.exists || teamSnap.data()?.deleting) throw new Error("TEAM_NOT_FOUND");
        const currentTeam = teamSnap.data() || {};
        if (currentTeam.managerId === uid) throw new Error("MANAGER_MUST_TRANSFER");
        if (!m.exists || m.data()?.active === false) return;
        const now=Timestamp.now();
        // Keep the leave path independent of a composite Firestore index.
        // The membership history is scoped to one team and filtered in memory.
        const historySnapshot=await tx.get(ref.collection("membershipHistory").where("userId","==",uid));
        tx.set(memberRef(adminDb,teamId,uid),{active:false,leaveAt:now},{merge:true});
        historySnapshot.docs
          .filter((d:any)=>d.data()?.active===true)
          .slice(0,1)
          .forEach((d:any)=>tx.update(d.ref,{active:false,leaveAt:now}));
        tx.update(ref,{memberCount:Math.max(0,Number(currentTeam.memberCount||0)-1)});
      });
      return NextResponse.json({ok:true});
    }

    if (action === "rename" || action === "edit") {
      const nextName = action === "rename" || body.name !== undefined ? normalizeTeamName(body?.name) : "";
      if ((action === "rename" || body.name !== undefined) && !nextName) {
        return NextResponse.json({error:"Zadej název týmu."},{status:400});
      }
      const nextDescription = body.description !== undefined ? normalizeDescription(body.description) : undefined;
      const nextAvatarUrl = body.avatarUrl !== undefined ? (typeof body.avatarUrl==="string" ? body.avatarUrl : "") : undefined;
      const nextAvatarPublicId = body.avatarPublicId !== undefined ? (typeof body.avatarPublicId==="string" ? body.avatarPublicId : "") : undefined;

      await adminDb.runTransaction(async tx => {
        const teamSnap = await tx.get(ref);
        if (!teamSnap.exists || teamSnap.data()?.deleting) throw new Error("TEAM_NOT_FOUND");
        const currentTeam = teamSnap.data() || {};
        if (currentTeam.managerId !== uid) throw new Error("NOT_MANAGER");

        const updates:any = {};
        const image = (nextAvatarUrl !== undefined || nextAvatarPublicId !== undefined) ? teamImage({ avatarUrl: nextAvatarUrl ?? currentTeam.avatarUrl ?? "", avatarPublicId: nextAvatarPublicId ?? currentTeam.avatarPublicId ?? "" }, uid) : undefined;
        if (nextName) {
          const nextKey = normalizeKey(nextName);
          const oldKey = String(currentTeam.nameKey || "");
          if (nextKey !== oldKey) {
            const newNameRef = adminDb.collection("teamNames").doc(nextKey);
            const existing = await tx.get(newNameRef);
            if (existing.exists) throw new Error("TEAM_NAME_TAKEN");
            if (oldKey) tx.delete(adminDb.collection("teamNames").doc(oldKey));
            tx.create(newNameRef,{teamId,createdAt:currentTeam.createdAt||Timestamp.now()});
            updates.name = nextName;
            updates.nameKey = nextKey;
          }
        }
        if (nextDescription !== undefined) updates.description = nextDescription;
        if (image) { updates.avatarUrl = image.avatarUrl; updates.avatarPublicId = image.avatarPublicId; }
        if (Object.keys(updates).length) tx.update(ref,updates);
      });
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
        const currentSnap=await tx.get(memberRef(adminDb,teamId,uid));
        if(!teamSnap.exists || teamSnap.data()?.deleting || teamSnap.data()?.managerId!==uid) throw new Error("NOT_MANAGER");
        if(!targetSnap.exists || targetSnap.data()?.active===false) throw new Error("TARGET_NOT_MEMBER");

        const now = Timestamp.now();
        const leaving = body?.leaveCurrentManager === true;
        if(leaving && (!currentSnap.exists || currentSnap.data()?.active === false))throw new Error("CURRENT_MANAGER_NOT_MEMBER");
        const history = leaving ? await tx.get(ref.collection("membershipHistory").where("userId","==",uid)) : null;
        tx.update(ref,{managerId:newManagerId});
        if(leaving){
          tx.update(memberRef(adminDb,teamId,uid),{active:false,leaveAt:now});
          history?.docs.filter(d => d.data().active === true).forEach(d => tx.update(d.ref,{active:false,leaveAt:now}));
          tx.update(ref,{memberCount:Math.max(0,Number(teamSnap.data()?.memberCount||0)-1)});
        }
      });
      return NextResponse.json({ok:true});
    }

    if (action === "delete") {
      await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists) throw new Error("TEAM_NOT_FOUND");
        const data=snap.data()||{};
        if(data.managerId!==uid) throw new Error("NOT_MANAGER");
        const nameKey=String(data.nameKey||"");
        const nameRef=nameKey ? adminDb.collection("teamNames").doc(nameKey) : null;
        const nameSnap=nameRef ? await tx.get(nameRef) : null;
        tx.update(ref,{deleting:true});
        if(nameRef && nameSnap?.data()?.teamId===teamId)tx.delete(nameRef);
      });
      await adminDb.recursiveDelete(ref);
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:"Neznámá operace."},{status:400});
  } catch(error) {
    const authError=authErrorResponse(error);
    if(authError)return NextResponse.json({error:authError.message},{status:authError.status});
    const message=error instanceof Error?error.message:"";
    const map:any={
      UNAUTHORIZED:["Nejsi přihlášen.",401],TEAM_NAME_TAKEN:["Tým s tímto názvem už existuje.",409],INVALID_TEAM_IMAGE:["Obrázek týmu není platný.",400],
      TEAM_CREATE_LIMIT:["Můžeš vytvořit nejvýše 5 týmů.",409],TEAM_NOT_FOUND:["Tým nebyl nalezen.",404],
      NOT_MANAGER:["Správu může převést jen současný správce.",403],
      MANAGER_MUST_TRANSFER:["Nejdřív předej správu týmu jinému členovi.",409],
      CURRENT_MANAGER_NOT_MEMBER:["Současný správce už není členem týmu.",409],
      TARGET_NOT_MEMBER:["Nový správce musí být členem týmu.",400]
    };
    const [text,status]=map[message]||["Operaci týmu se nepodařilo dokončit.",500];
    console.error("POST /api/teams/manage:",error);
    return NextResponse.json({error:text},{status});
  }
}