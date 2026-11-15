"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trophy, Target } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { fetchChallengesPage } from "../lib/services/challenges";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { showAppToast } from "../components/AppToast";
import type { ActivityType, ChallengeData, ChallengeKind } from "../types";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

const MONTHS = ["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"];

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("cs-CZ",{day:"numeric",month:"numeric",year:"numeric"}).format(new Date(value+"T12:00:00")); }
function kindLabel(kind: ChallengeKind) {
  return kind==="distance" ? "Vzdálenost" : kind==="activities" ? "Počet aktivit" : kind==="activeDays" ? "Aktivní dny" : "Společný cíl";
}
function unit(kind: ChallengeKind) { return kind==="distance"||kind==="sharedDistance" ? "km" : kind==="activities" ? "aktivit" : "dnů"; }
function progress(challenge: ChallengeData) {
  if (challenge.kind === "sharedDistance") {
    const value = Number(challenge.sharedProgress || 0);
    return `${value.toFixed(1)} / ${Number(challenge.goal).toFixed(1)} km`;
  }
  const decimals = challenge.kind === "distance" ? 1 : 0;
  return `Cíl: ${Number(challenge.goal).toFixed(decimals)} ${unit(challenge.kind)}`;
}

export default function ChallengesPage() {
  const router=useRouter();
  const [menuVisible,setMenuVisible]=useState(false);
  const [user,setUser]=useState<User|null>(null);
  const [activityType,setActivityType]=useState<ActivityType>("běh");
  const [month,setMonth]=useState(()=>new Date());
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [kind,setKind]=useState<ChallengeKind>("distance");
  const [goal,setGoal]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [groups,setGroups]=useState<Record<ChallengeData["state"], ChallengeData[]>>({active:[],planned:[],completed:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<Error|null>(null);
  const [page,setPage]=useState(1);
  const [cursors,setCursors]=useState<Array<Record<ChallengeData["state"], QueryDocumentSnapshot<DocumentData, DocumentData>|undefined>>>([{active: undefined, planned: undefined, completed: undefined}]);
  const [hasMore,setHasMore]=useState(false);

  useEffect(()=>{ const unsub=onAuthStateChanged(auth,u=>{ if(!u){router.push("/login");return;} setUser(u); try{const v=localStorage.getItem("dolni-lhota-default-activity-v1"); if(v==="běh"||v==="chůze")setActivityType(v);}catch{} }); return ()=>unsub(); },[router]);

  const request=async(action:string,payload:Record<string,unknown>)=>{
    if(!auth.currentUser)throw new Error("Nejsi přihlášen.");
    const token=await auth.currentUser.getIdToken(true);
    const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload})});
    const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||"Operaci se nepodařilo dokončit."); return data;
  };

  const create=async()=>{
    if(!user||creating||!name.trim()||!goal||!startDate||!endDate)return;
    setCreating(true);
    try{
      const data=await request("create",{name,description,kind,activityType,goal:Number(goal),startDate,endDate});
      setName("");setDescription("");setGoal("");setStartDate("");setEndDate("");
      showAppToast("Výzva byla vytvořena.","success");
      if(data.id)router.push("/challenges/"+data.id);
    }catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo vytvořit.","error");}
    finally{setCreating(false);}
  };

  const key=monthKey(month);
  const monthStart = `${key}-01`;
  const monthEndDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const monthEnd = `${monthKey(monthEndDate)}-${String(monthEndDate.getDate()).padStart(2, "0")}`;
  const shift=(delta:number)=>{setMonth(current=>new Date(current.getFullYear(),current.getMonth()+delta,1));setPage(1);setCursors([{active: undefined, planned: undefined, completed: undefined}]);};

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const cursorSet = cursors[page - 1] || {};
    Promise.all((["active","planned","completed"] as const).map(async state => {
      const result = await fetchChallengesPage(activityType, state, monthStart, monthEnd, 10, cursorSet[state]);
      return [state, result] as const;
    })).then(results => {
      if (cancelled) return;
      setGroups({ active: results[0][1].items, planned: results[1][1].items, completed: results[2][1].items });
      setHasMore(results.some(([, result]) => result.hasMore));
      if (results.some(([, result]) => result.lastDocument)) {
        const next = results.reduce((acc, [state, result]) => ({...acc, [state]: result.lastDocument || undefined}), {} as Record<ChallengeData["state"], QueryDocumentSnapshot<DocumentData, DocumentData>|undefined>);
        setCursors((current: Array<Record<ChallengeData["state"], QueryDocumentSnapshot<DocumentData, DocumentData>|undefined>>) => current.length === page ? [...current, next] : current);
      }
    }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e : new Error("Výzvy se nepodařilo načíst."));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activityType, monthStart, monthEnd, page]);

  return <>
    <Navbar title="Výzvy" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={item=>{setMenuVisible(false); const routes:any={home:"/",myrun:"/myruns",teams:"/teams",challenges:"/challenges",settings:"/settings",statistics:"/statistics",participants:"/participants",progress:"/progress",trainer:"/trainer",weather:"/weather",admin:"/admin"}; router.push(routes[item]||"/");}}/>
    <main className="container challenges-page">
      <header className="teams-header"><span className="teams-eyebrow">SOUTĚŽ A MOTIVACE</span><h1>Výzvy</h1><p>Zapoj se do výzvy nebo vytvoř vlastní.</p></header>
      <section className="tile challenges-create">
        <div className="teams-section-heading"><div><h2>Vytvořit výzvu</h2><p>Výzvy jsou veřejné a po vytvoření se automaticky účastníš.</p></div></div>
        <div className="teams-create-form">
          <input maxLength={40} placeholder="Název výzvy" value={name} onChange={e=>setName(e.target.value)}/>
          <input maxLength={200} placeholder="Krátký popis (volitelné)" value={description} onChange={e=>setDescription(e.target.value)}/>
          <div className="activity-type-switch"><button className={activityType==="běh"?"active":""} onClick={()=>setActivityType("běh")}>🏃 Běh</button><button className={activityType==="chůze"?"active":""} onClick={()=>setActivityType("chůze")}>🚶 Chůze</button></div>
          <select value={kind} onChange={e=>setKind(e.target.value as ChallengeKind)}><option value="distance">Vzdálenost</option><option value="activities">Počet aktivit</option><option value="activeDays">Aktivní dny</option><option value="sharedDistance">Společný cíl</option></select>
          <input type="number" min="1" step={kind==="distance"||kind==="sharedDistance"?"0.1":"1"} placeholder={kind==="distance"||kind==="sharedDistance"?"Cíl v km":kind==="activities"?"Počet aktivit":"Počet aktivních dnů"} value={goal} onChange={e=>setGoal(e.target.value)}/>
          <div className="challenge-dates"><label>Od<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>Do<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>
          <button className="run-primary-button" onClick={()=>void create()} disabled={creating||!name.trim()||!goal||!startDate||!endDate}><Plus size={18}/>{creating?"Vytvářím…":"Vytvořit výzvu"}</button>
        </div>
      </section>
      <div className="activity-type-switch challenge-type-switch"><button className={activityType==="běh"?"active":""} onClick={()=>setActivityType("běh")}>🏃 Běh</button><button className={activityType==="chůze"?"active":""} onClick={()=>setActivityType("chůze")}>🚶 Chůze</button></div>
      <div className="challenge-month"><button onClick={()=>shift(-1)} aria-label="Předchozí měsíc"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={()=>shift(1)} aria-label="Další měsíc"><ChevronRight/></button></div>
      {loading?<LoadingSkeleton count={4}/>:error?<div className="tile teams-empty">Výzvy se nepodařilo načíst.</div>:([["active",groups.active],["planned",groups.planned],["completed",groups.completed]] as const).map(([state,items])=><section key={state} className="challenge-group"><h2>{state==="active"?"Aktivní":state==="planned"?"Plánované":"Dokončené"}</h2><div className="teams-grid">{items.map(c=><article key={c.id} className="tile team-card challenge-card" onClick={()=>router.push("/challenges/"+c.id)}>
        <div className="team-card-main"><div className="team-avatar">{c.avatarUrl?<img src={cloudinaryImageUrl(c.avatarUrl,96)} alt=""/>:<Target size={22}/>}</div><div className="team-card-info"><div className="team-card-title-row"><h3>{c.name}</h3></div>{c.description&&<p className="team-card-description">{c.description}</p>}<p className="team-card-meta">{kindLabel(c.kind)} · {c.activityType==="běh"?"Běh":"Chůze"}</p><div className="team-card-stats"><span>{progress(c)}</span><span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span></div></div><ChevronRight className="team-card-chevron" size={20}/></div></article>)}</div></section>)}
      {!loading&&!error&&(groups.active.length||groups.planned.length||groups.completed.length)&&<div className="challenge-pagination"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Předchozí</button><strong>Strana {page}</strong><button onClick={()=>setPage(p=>p+1)} disabled={!hasMore}>Další</button></div>}
      {!loading&&!error&&!groups.active.length&&!groups.planned.length&&!groups.completed.length&&<div className="tile teams-empty"><Trophy size={30}/><strong>V tomto měsíci nejsou žádné výzvy.</strong><p>Zkus jiný měsíc nebo vytvoř vlastní výzvu.</p></div>}
    </main>
  </>;
}
