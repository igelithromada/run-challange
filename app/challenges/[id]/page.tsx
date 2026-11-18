"use client";
import { CheckCircle2, Target } from "lucide-react";
import { challengeKindFor, challengeUnit, sharedChallenge } from "../../lib/challengeMeasurement";
import { isStrengthActivity } from "../../lib/activity";
import { preparePhoto } from "../../lib/preparePhoto";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Trophy, Save, X } from "lucide-react";
import { auth } from "../../lib/firebase";
import Metric from "../../components/Metric";
import { formatMetricNumber } from "../../lib/activityMetrics";
import ChallengeSummaryCard from "../../components/ChallengeSummaryCard";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { fetchChallengeParticipantsPage, getChallenge, getChallengeParticipant } from "../../lib/services/challenges";
import { cloudinaryImageUrl } from "../../lib/imageUrl";
import { showAppToast } from "../../components/AppToast";
import { getPublicProfiles } from "../../lib/services/publicProfiles";
import ActivityTypeSelector from "../../components/ActivityTypeSelector";
import type { PublicProfileData, ChallengeData } from "../../types";

async function uploadChallengeImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Povolené jsou pouze JPG, PNG a WebP.");
  if (file.size <= 0) throw new Error("Vybraná fotografie je prázdná.");
  if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
  const token = await auth.currentUser.getIdToken();
  const form = new FormData();
  form.append("file", await preparePhoto(file));
  const response = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.secureUrl !== "string") throw new Error(data.error || "Obrázek se nepodařilo nahrát.");
  return { secureUrl: data.secureUrl, publicId: typeof data.publicId === "string" ? data.publicId : "" };
}

function GoalProgress({ result, goal, kind, completed }: {
 result: number; goal: number; kind: ChallengeData["kind"]; completed: boolean;
}) {
 const unit = challengeUnit(kind);
 const percent = goal > 0 ? Math.max(0, Math.round(result / goal * 100)) : 0;
 const reached = goal > 0 && result >= goal;
 const remaining = Math.max(0, goal - result);
 return <div className={`challenge-goal-progress${reached ? " is-reached" : ""}`}>
  <Metric icon={reached ? <CheckCircle2/> : <Target/>} tone={reached ? "success" : "target"}
    label="Plnění cíle" value={`${formatMetricNumber(result)} / ${formatMetricNumber(goal)}`} unit={unit} detail={`${percent} %`}/>
  <progress aria-label="Plnění cíle" aria-valuetext={`${percent} %`} max={100} value={Math.min(100, percent)} />
  <span className="challenge-progress-caption">
   {reached ? <><CheckCircle2 size={15} /> Cíl splněn</>
    : <>{completed ? "Do cíle chybělo" : "Do cíle zbývá"} {formatMetricNumber(remaining)} {unit}</>}
  </span>
 </div>;
}

export default function ChallengeDetailPage(){
 const params=useParams<{id:string}>(), router=useRouter();
 const id=String(params.id||"");
 const [menu,setMenu]=useState(false),[user,setUser]=useState<User|null>(null),[challenge,setChallenge]=useState<ChallengeData|null>(null),[participants,setParticipants]=useState<any[]>([]),[profiles,setProfiles]=useState<Record<string,PublicProfileData>>({}),[author,setAuthor]=useState<PublicProfileData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[pageCursors,setPageCursors]=useState<any[]>([undefined]),[hasMore,setHasMore]=useState(false),[membership,setMembership]=useState<any>(null),[editing,setEditing]=useState(false),[editName,setEditName]=useState(""),[editDescription,setEditDescription]=useState(""),[editKind,setEditKind]=useState<ChallengeData["kind"]>("distance"),[editType,setEditType]=useState<ChallengeData["activityType"]>("běh"),[editGoal,setEditGoal]=useState(""),[editStart,setEditStart]=useState(""),[editEnd,setEditEnd]=useState(""),[editAvatarUrl,setEditAvatarUrl]=useState(""),[editAvatarPublicId,setEditAvatarPublicId]=useState(""),[uploadingImage,setUploadingImage]=useState(false);
 const load=async()=>{if(!id)return;setLoading(true);try{await request("refresh");const c=await getChallenge(id);setChallenge(c);if(c){setEditName(c.name);setEditDescription(c.description||"");setEditKind(c.kind === "repetitions" ? "distance" : c.kind === "sharedRepetitions" ? "sharedDistance" : c.kind);setEditType(c.activityType);setEditGoal(String(c.goal));setEditStart(c.startDate);setEditEnd(c.endDate);setEditAvatarUrl(c.avatarUrl||"");setEditAvatarPublicId(c.avatarPublicId||"");
        try {
          const authorProfile = c.createdBy ? await getPublicProfiles([c.createdBy]) : {};
          setAuthor(c.createdBy ? authorProfile[c.createdBy] || null : null);
        } catch (error) { console.error("Challenge author profile unavailable:", error); setAuthor(null); }
        if(sharedChallenge(c.kind)){setParticipants([]);setHasMore(false);} else {const result=await fetchChallengeParticipantsPage(id,c,10,pageCursors[page-1]);setParticipants(result.items);setHasMore(result.hasMore);setPageCursors(current=>current.length===page?[...current,result.lastDocument||undefined]:current);if(result.items.length) {
          try { setProfiles(await getPublicProfiles(result.items.map((x:any)=>String(x.userId||x.id)))); }
          catch (error) { console.error("Challenge participant profiles unavailable:", error); setProfiles({}); }
        }}
        if(user?.uid) setMembership(await getChallengeParticipant(id,user.uid));
      }}catch(e){console.error(e);showAppToast("Výzvu se nepodařilo načíst.","error")}finally{setLoading(false)}};
 useEffect(()=>{const unsub=onAuthStateChanged(auth,u=>{if(!u){router.push("/login");return;}setUser(u)});return()=>unsub()},[router]);
 useEffect(()=>{if(user)void load()},[id,page,user]);
 const editRequest=async()=>{if(!challenge||busy||!isOwner)return;setBusy(true);try{if(!auth.currentUser)throw new Error("Nejsi přihlášen.");const token=await auth.currentUser.getIdToken(true);const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"edit",challengeId:id,name:editName,description:editDescription,kind:challengeKindFor(editType,editKind),activityType:editType,goal:Number(editGoal),startDate:editStart,endDate:editEnd,avatarUrl:editAvatarUrl,avatarPublicId:editAvatarPublicId})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Výzvu se nepodařilo upravit.");setEditing(false);await load();showAppToast("Výzva byla upravena.","success")}catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo upravit.","error")}finally{setBusy(false)}};
 async function request(action:string){if(!auth.currentUser)throw new Error("Nejsi přihlášen.");const token=await auth.currentUser.getIdToken(true);const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,challengeId:id})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Operaci se nepodařilo dokončit.");};
 const active=Boolean(membership?.active), isOwner=challenge?.createdBy===user?.uid;
 const joinLeave=async()=>{if(!challenge||busy)return;if(active&&!confirm("Opravdu chceš z výzvy odejít? Tvůj dosavadní výsledek bude odstraněn."))return;setBusy(true);try{await request(active?"leave":"join");showAppToast(active?"Odešel jsi z výzvy.":"Přidal ses k výzvě.","success");await load()}catch(e){showAppToast(e instanceof Error?e.message:"Operace se nepodařila.","error")}finally{setBusy(false)}};
 const remove=async()=>{if(!challenge||busy||!isOwner)return;if(!confirm("Opravdu chceš výzvu trvale smazat?"))return;setBusy(true);try{await request("delete");showAppToast("Výzva byla smazána.","success");router.push("/challenges")}catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo smazat.","error")}finally{setBusy(false)}};
 const challengeNavigation = <Sidebar visible={menu} onClose={()=>setMenu(false)}/>;
 if(loading)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/>{challengeNavigation}<main className="container"><LoadingSkeleton count={4}/></main></>;
 if(!challenge)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/>{challengeNavigation}<main className="container"><div className="tile teams-empty"><strong>Výzva nebyla nalezena.</strong><p>Výzva už neexistuje nebo k ní nemáš přístup.</p><button type="button" className="run-primary-button" onClick={()=>router.push("/challenges")}>Zpět na výzvy</button></div></main></>;
 const shared = sharedChallenge(challenge.kind);
 const completed = challenge.state === "completed";
 const goal = Number(challenge.goal || 0);
 return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/><Sidebar visible={menu} onClose={()=>setMenu(false)}/>
 <main className="container challenge-detail-page"><button className="back-button" onClick={()=>router.push("/challenges")}><ArrowLeft size={18}/> Zpět na výzvy</button>
 <ChallengeSummaryCard challenge={challenge} joined={active} authorName={author?.nickname || "Uživatel"} detail />
 {isOwner&&challenge.state==="planned"&&<section className="tile challenge-edit-card">{!editing?<button className="run-secondary-button" onClick={()=>setEditing(true)}><Save size={17}/> Upravit výzvu</button>:<><div className="teams-section-heading"><div><h2>Upravit výzvu</h2><p>Úpravy jsou možné pouze před začátkem.</p></div><button type="button" className="ui-icon-button" onClick={()=>setEditing(false)} aria-label="Zavřít úpravy"><X size={18}/></button></div><div className="teams-create-form"><input maxLength={40} value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Název výzvy"/><input maxLength={200} value={editDescription} onChange={e=>setEditDescription(e.target.value)} placeholder="Popis"/><ActivityTypeSelector value={editType} onChange={setEditType} ariaLabel="Typ aktivity výzvy" /><select value={editKind} onChange={e=>setEditKind(e.target.value as ChallengeData["kind"])}><option value="distance">{isStrengthActivity(editType) ? "Počet opakování" : "Vzdálenost"}</option><option value="activities">Počet aktivit</option><option value="activeDays">Aktivní dny</option><option value="sharedDistance">Společný cíl</option></select><input type="number" min="1" step={!isStrengthActivity(editType) && (editKind==="distance"||editKind==="sharedDistance")?"0.1":"1"} value={editGoal} onChange={e=>setEditGoal(e.target.value)}/><div className="challenge-dates"><label>Od<input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}/></label><label>Do<input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}/></label></div><label className="run-form-field"><span>Obrázek <small>volitelné</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage||busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploadingImage(true);try{const uploaded=await uploadChallengeImage(file);setEditAvatarUrl(uploaded.secureUrl);setEditAvatarPublicId(uploaded.publicId);showAppToast("Obrázek byl nahrán.","success");}catch(err){showAppToast(err instanceof Error?err.message:"Obrázek se nepodařilo nahrát.","error");}finally{setUploadingImage(false);}}}/>{editAvatarUrl&&<div className="challenge-image-preview"><img src={cloudinaryImageUrl(editAvatarUrl,160)} alt="Náhled obrázku výzvy"/><button type="button" className="run-secondary-button" onClick={()=>{setEditAvatarUrl("");setEditAvatarPublicId("");}}>Odebrat obrázek</button></div>}</label><button className="run-primary-button" onClick={()=>void editRequest()} disabled={busy||uploadingImage||!editName.trim()||!editGoal||!editStart||!editEnd}><Save size={17}/>{busy?"Ukládám…":"Uložit změny"}</button></div></>}</section>}
 {challenge.state !== "completed" && <section className="tile challenge-action-row"><button className="run-primary-button" onClick={()=>void joinLeave()} disabled={busy}>{active?<><LogOut size={17}/> Odejít z výzvy</>:"Přidat se k výzvě"}</button>{isOwner&&challenge.state==="planned"&&<button className="run-danger-button" onClick={()=>void remove()} disabled={busy}>Smazat výzvu</button>}</section>}
 <section className="tile challenge-results-section">
  <div className="challenge-results-header">
   <h2>{shared ? "Společný výsledek" : "Výsledky"}</h2>
   {completed && <span className={`challenge-goal-status${challenge.goalReached ? " is-reached" : ""}`}>
    {challenge.goalReached ? <CheckCircle2 size={16} /> : <Target size={16} />}
    {challenge.goalReached ? "Cíl splněn" : "Cíl nesplněn"}
   </span>}
  </div>
  {shared ? <>
   <GoalProgress result={Number(challenge.sharedProgress || 0)} goal={goal} kind={challenge.kind} completed={completed} />
   <p className="challenge-progress-caption">Počet účastníků: {Number(challenge.participantCount || 0)}</p>
  </> : participants.length ? <ol className="challenge-result-list">
   {participants.map((participant, index) => {
    const mine = participant.id === user?.uid;
    const winner = participant.id === challenge.winnerId;
    const result = Number((completed ? participant.finalResult ?? participant.result : participant.result) || 0);
    const rank = (completed && participant.finalRank) || (page - 1) * 10 + index + 1;
    return <li key={participant.id} className={`challenge-result-entry${mine ? " is-mine" : ""}`}>
     <header>
      <span className="challenge-result-rank">{rank}.</span>
      <strong>{mine ? "Ty" : profiles[String(participant.userId || participant.id)]?.nickname || "Uživatel"}</strong>
      {winner && <span className="challenge-result-winner"><Trophy size={16} /> Vítěz</span>}
     </header>
     <GoalProgress result={result} goal={goal} kind={challenge.kind} completed={completed} />
    </li>;
   })}
  </ol> : <p>Výzva zatím nemá účastníky.</p>}
  {(page > 1 || hasMore) && <div className="teams-pagination">
   <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Předchozí</button>
   <strong>Strana {page}</strong>
   <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}>Další</button>
  </div>}
 </section>
 </main></>;
}
