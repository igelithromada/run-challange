"use client";
import EntryFormPanel from "../../components/EntryFormPanel";
import { CheckCircle2, Target } from "lucide-react";
import { challengeKindFor, challengeUnit, sharedChallenge } from "../../lib/challengeMeasurement";
import { isStrengthActivity } from "../../lib/activity";
import CoverField, { useCoverDraft } from "../../components/CoverField";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Trophy, Save } from "lucide-react";
import { auth } from "../../lib/firebase";
import FormField from "../../components/FormField";
import Metric from "../../components/Metric";
import { formatMetricNumber } from "../../lib/activityMetrics";
import ChallengeSummaryCard from "../../components/ChallengeSummaryCard";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import PeopleList from "../../components/PeopleList";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { getRankedChallengeParticipants, getChallenge, getChallengeParticipant } from "../../lib/services/challenges";
import { showAppToast } from "../../components/AppToast";
import { getPublicProfiles } from "../../lib/services/publicProfiles";
import ActivityTypeSelector from "../../components/ActivityTypeSelector";
import type { PublicProfileData, ChallengeData, ChallengeParticipant } from "../../types";


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
 const [menu,setMenu]=useState(false),[user,setUser]=useState<User|null>(null),[challenge,setChallenge]=useState<ChallengeData|null>(null),[participants,setParticipants]=useState<ChallengeParticipant[]>([]),[profiles,setProfiles]=useState<Record<string,PublicProfileData>>({}),[author,setAuthor]=useState<PublicProfileData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[membership,setMembership]=useState<ChallengeParticipant|null>(null),[editing,setEditing]=useState(false),[editName,setEditName]=useState(""),[editDescription,setEditDescription]=useState(""),[editKind,setEditKind]=useState<ChallengeData["kind"]>("distance"),[editType,setEditType]=useState<ChallengeData["activityType"]>("běh"),[editGoal,setEditGoal]=useState(""),[editStart,setEditStart]=useState(""),[editEnd,setEditEnd]=useState("");
 const cover = useCoverDraft(`${user?.uid || ""}/${id}`);
 const [loadError, setLoadError] = useState(false);
 const [reload, setReload] = useState(0);
 const [rosterError, setRosterError] = useState(false);
 const [rosterLimit, setRosterLimit] = useState(10);
 const uid = user?.uid;
 const pageSize = 10;
 const currentPage = Math.min(page, Math.max(1, Math.ceil(participants.length / pageSize)));
 const visibleParticipants = participants.slice((currentPage - 1) * pageSize, currentPage * pageSize);
 const rosterIds = [...new Set(participants.map(participant => participant.userId || participant.id))];
 const roster = rosterIds.slice(0, rosterLimit).map(id => ({ ...profiles[id], id }));

 useEffect(() => onAuthStateChanged(auth, current => {
   setUser(current);
   if (!current) router.push("/login");
 }), [router]);

 useEffect(() => {
   if (!id || !uid) return;
   const controller = new AbortController();
   const { signal } = controller;
   const isCurrent = () => !signal.aborted && auth.currentUser?.uid === uid;
   setLoading(true);
   setLoadError(false);
   setRosterError(false);
   void (async () => {
     try {
       const c = await getChallenge(id, signal);
       if (!isCurrent()) return;
       setChallenge(c);
       if (!c) return;
       const [rows, member] = await Promise.all([
         getRankedChallengeParticipants(id, c.state === "completed", signal).catch(() => null),
         getChallengeParticipant(id, signal),
       ]);
       if (!isCurrent()) return;
       setParticipants(rows ?? []);
       setRosterError(rows === null);
       setMembership(member);
       setEditName(c.name);
       setEditDescription(c.description || "");
       setEditKind(c.kind === "repetitions" ? "distance" : c.kind === "sharedRepetitions" ? "sharedDistance" : c.kind);
       setEditType(c.activityType);
       setEditGoal(String(c.goal));
       setEditStart(c.startDate);
       setEditEnd(c.endDate);
       setAuthor(null);
       if (c.createdBy) void getPublicProfiles([c.createdBy]).then(next => {
         if (isCurrent()) setAuthor(next[c.createdBy!] ?? null);
       }).catch(() => {});
     } catch (error) {
       if (isCurrent()) {
         console.error("Výzvu se nepodařilo načíst:", error);
         setLoadError(true);
       }
     } finally {
       if (isCurrent()) setLoading(false);
     }
   })();
   return () => controller.abort();
 }, [id, uid, reload]);

 useEffect(() => { setPage(1); setRosterLimit(10); setProfiles({}); setEditing(false); }, [id, uid]);
 useEffect(() => {
   let active = true;
   const pageStart = (currentPage - 1) * pageSize;
   const ids = participants.slice(0, rosterLimit).map(participant => participant.userId || participant.id);
   if (challenge && !sharedChallenge(challenge.kind) && pageStart + pageSize > rosterLimit) {
     ids.push(...participants.slice(pageStart, pageStart + pageSize).map(participant => participant.userId || participant.id));
   }
   if (ids.length) void getPublicProfiles(ids).then(next => {
     if (active) setProfiles(previous => ({ ...previous, ...next }));
   }).catch(() => {});
   return () => { active = false; };
 }, [participants, currentPage, rosterLimit, challenge]);

 const editRequest=async()=>{if(!challenge||busy||!isOwner)return;setBusy(true);try{if(!auth.currentUser)throw new Error("Nejsi přihlášen.");const token=await auth.currentUser.getIdToken(true);const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"edit",challengeId:id,name:editName,description:editDescription,kind:challengeKindFor(editType,editKind),activityType:editType,goal:Number(editGoal),startDate:editStart,endDate:editEnd,...await cover.resolve(challenge)})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Výzvu se nepodařilo upravit.");cover.reset();setEditing(false);setReload(value=>value+1);showAppToast("Výzva byla upravena.","success")}catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo upravit.","error")}finally{setBusy(false)}};
 async function request(action:string){if(!auth.currentUser)throw new Error("Nejsi přihlášen.");const token=await auth.currentUser.getIdToken(true);const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,challengeId:id})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Operaci se nepodařilo dokončit.");};
 const active=Boolean(membership?.active), isOwner=challenge?.createdBy===user?.uid;
 const joinLeave=async()=>{if(!challenge||busy)return;if(active&&!confirm("Opravdu chceš z výzvy odejít? Tvůj dosavadní výsledek bude odstraněn."))return;setBusy(true);try{await request(active?"leave":"join");showAppToast(active?"Odešel jsi z výzvy.":"Přidal ses k výzvě.","success");setReload(value=>value+1)}catch(e){showAppToast(e instanceof Error?e.message:"Operace se nepodařila.","error")}finally{setBusy(false)}};
 const remove=async()=>{if(!challenge||busy||!isOwner)return;if(!confirm("Opravdu chceš výzvu trvale smazat?"))return;setBusy(true);try{await request("delete");showAppToast("Výzva byla smazána.","success");router.push("/challenges")}catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo smazat.","error")}finally{setBusy(false)}};
 const challengeNavigation = <Sidebar visible={menu} onClose={()=>setMenu(false)}/>;
 if(loading)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/>{challengeNavigation}<main className="container"><LoadingSkeleton count={4}/></main></>;
 if(loadError || !challenge)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/>{challengeNavigation}<main className="container"><div className="tile teams-empty"><strong>{loadError ? "Výzvu se nepodařilo načíst." : "Výzva nebyla nalezena."}</strong>{loadError ? <button type="button" className="tile-button" onClick={() => setReload(value => value + 1)}>Zkusit znovu</button> : <p>Výzva už neexistuje nebo k ní nemáš přístup.</p>}<button type="button" className="run-primary-button" onClick={()=>router.push("/challenges")}>Zpět na výzvy</button></div></main></>;
 const shared = sharedChallenge(challenge.kind);
 const completed = challenge.state === "completed";
 const goal = Number(challenge.goal || 0);
 return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/><Sidebar visible={menu} onClose={()=>setMenu(false)}/>
 <main className="container challenge-detail-page"><button className="back-button" onClick={()=>router.push("/challenges")}><ArrowLeft size={18}/> Zpět na výzvy</button>
 <ChallengeSummaryCard challenge={challenge} joined={active} authorName={author?.nickname || "Uživatel"} participantsHref="#ucastnici" detail />
 {isOwner&&challenge.state==="planned"&&<section className="tile challenge-edit-card">{!editing?<button className="run-secondary-button" onClick={()=>setEditing(true)}><Save size={17}/> Upravit výzvu</button>:<EntryFormPanel title="Upravit výzvu" description="Úpravy jsou možné pouze před začátkem." busy={busy} onClose={()=>{cover.reset();setEditing(false)}}><FormField label="Název výzvy"><input maxLength={40} value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Název výzvy"/></FormField><FormField label="Popis" hint="volitelné"><textarea maxLength={200} value={editDescription} onChange={e=>setEditDescription(e.target.value)} placeholder="Popis"/></FormField><FormField label="Typ aktivity" group><ActivityTypeSelector value={editType} onChange={setEditType} ariaLabel="Typ aktivity výzvy" /></FormField><FormField label="Typ cíle"><select value={editKind} onChange={e=>setEditKind(e.target.value as ChallengeData["kind"])}><option value="distance">{isStrengthActivity(editType) ? "Počet opakování" : "Vzdálenost"}</option><option value="activities">Počet aktivit</option><option value="activeDays">Aktivní dny</option><option value="sharedDistance">Společný cíl</option></select></FormField><FormField label="Cíl"><input type="number" min="1" step={!isStrengthActivity(editType) && (editKind==="distance"||editKind==="sharedDistance")?"0.1":"1"} value={editGoal} onChange={e=>setEditGoal(e.target.value)}/></FormField><div className="challenge-dates"><FormField label="Od"><input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}/></FormField><FormField label="Do"><input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}/></FormField></div><CoverField draft={cover} existing={challenge.avatarUrl} busy={busy}/><button className="run-primary-button" onClick={()=>void editRequest()} disabled={busy||!editName.trim()||!editGoal||!editStart||!editEnd}><Save size={17}/>{busy?"Ukládám…":"Uložit změny"}</button></EntryFormPanel>}</section>}
 {challenge.state !== "completed" && <section className="tile challenge-action-row"><button className="run-primary-button" onClick={()=>void joinLeave()} disabled={busy}>{active?<><LogOut size={17}/> Odejít z výzvy</>:"Přidat se k výzvě"}</button>{isOwner&&challenge.state==="planned"&&<button className="run-danger-button" onClick={()=>void remove()} disabled={busy}>Smazat výzvu</button>}</section>}
 <PeopleList id="ucastnici" title="Účastníci" people={roster}
   empty={rosterError ? "Seznam účastníků se nepodařilo načíst." : "Výzva zatím nemá účastníky."}>
  {rosterError && <button type="button" className="run-secondary-button people-list-action" onClick={() => setReload(value => value + 1)}>Zkusit znovu</button>}
  {rosterIds.length > rosterLimit && <button type="button" className="run-secondary-button people-list-action"
    onClick={() => setRosterLimit(limit => limit + pageSize)}>Zobrazit další účastníky</button>}
 </PeopleList>
 <section className="tile challenge-results-section">
  <div className="challenge-results-header">
   <h2>{shared ? "Společný výsledek" : "Výsledky"}</h2>
   {completed && <span className={`challenge-goal-status${challenge.goalReached ? " is-reached" : ""}`}>
    {challenge.goalReached ? <CheckCircle2 size={16} /> : <Target size={16} />}
    {challenge.goalReached ? "Cíl splněn" : "Cíl nesplněn"}
   </span>}
  </div>
  {shared ? <GoalProgress result={Number(challenge.sharedProgress || 0)} goal={goal} kind={challenge.kind} completed={completed} />
  : rosterError ? <p>Výsledky se nepodařilo načíst.</p> : participants.length ? <ol className="challenge-result-list">
   {visibleParticipants.map((participant, index) => {
    const mine = participant.id === user?.uid;
    const winner = participant.id === challenge.winnerId;
    const result = Number((completed ? participant.finalResult ?? participant.result : participant.result) || 0);
    const rank = (completed && participant.finalRank) || (currentPage - 1) * pageSize + index + 1;
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
  {participants.length > pageSize && <div className="teams-pagination">
   <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Předchozí</button>
   <strong>Strana {currentPage} z {Math.ceil(participants.length / pageSize)}</strong>
   <button type="button" disabled={currentPage * pageSize >= participants.length} onClick={() => setPage(currentPage + 1)}>Další</button>
  </div>}
 </section>
 </main></>;
}
