"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trophy, Target, X } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { fetchChallengesPage, getActiveChallengeIdsForUser } from "../lib/services/challenges";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { showAppToast } from "../components/AppToast";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import FormField from "../components/FormField";

async function uploadChallengeImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Povolené jsou pouze JPG, PNG a WebP.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("Obrázek může mít maximálně 5 MB.");
  if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
  const token = await auth.currentUser.getIdToken();
  const form = new FormData(); form.append("file", file);
  const response = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.secureUrl !== "string") throw new Error(data.error || "Obrázek se nepodařilo nahrát.");
  return { secureUrl: data.secureUrl, publicId: typeof data.publicId === "string" ? data.publicId : "" };
}
import type { ActivityType, ChallengeData, ChallengeKind } from "../types";

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
  const [showCreate,setShowCreate]=useState(false);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [kind,setKind]=useState<ChallengeKind>("distance");
  const [goal,setGoal]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [avatarUrl,setAvatarUrl]=useState("");
  const [avatarPublicId,setAvatarPublicId]=useState("");
  const [uploadingImage,setUploadingImage]=useState(false);
  const [groups,setGroups]=useState<Record<ChallengeData["state"], ChallengeData[]>>({active:[],planned:[],completed:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<Error|null>(null);
  const [authors,setAuthors]=useState<Record<string, import("../types").PublicProfileData>>({});
  const [joinedChallengeIds,setJoinedChallengeIds]=useState<Set<string>>(new Set());

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
      const data=await request("create",{name,description,kind,activityType,goal:Number(goal),startDate,endDate,avatarUrl,avatarPublicId});
      const createdChallenge = data.challenge as ChallengeData | undefined;
      setName("");setDescription("");setGoal("");setStartDate("");setEndDate("");setAvatarUrl("");setAvatarPublicId("");
      if (createdChallenge) {
        setGroups(current => ({
          active: createdChallenge.state === "active" ? [createdChallenge, ...current.active.filter(item => item.id !== createdChallenge.id)] : current.active.filter(item => item.id !== createdChallenge.id),
          planned: createdChallenge.state === "planned" ? [createdChallenge, ...current.planned.filter(item => item.id !== createdChallenge.id)] : current.planned.filter(item => item.id !== createdChallenge.id),
          completed: current.completed.filter(item => item.id !== createdChallenge.id),
        }));
      }
      showAppToast("Výzva byla vytvořena.","success");
      setShowCreate(false);
      const createdStart = new Date(startDate + "T12:00:00");
      if (!Number.isNaN(createdStart.getTime())) setMonth(new Date(createdStart.getFullYear(), createdStart.getMonth(), 1));
    }catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo vytvořit.","error");}
    finally{setCreating(false);}
  };

  const key=monthKey(month);
  const monthStart = `${key}-01`;
  const monthEndDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const monthEnd = `${monthKey(monthEndDate)}-${String(monthEndDate.getDate()).padStart(2, "0")}`;
  const shift=(delta:number)=>{setMonth(current=>new Date(current.getFullYear(),current.getMonth()+delta,1));};

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all((["active","planned","completed"] as const).map(async state => {
      const result = await fetchChallengesPage(activityType, state, monthStart, monthEnd, 10);
      return [state, result] as const;
    })).then(async results => {
      if (cancelled) return;
      const nextGroups = { active: results[0][1].items, planned: results[1][1].items, completed: results[2][1].items };
      setGroups(nextGroups);
      const allItems = [...nextGroups.active, ...nextGroups.planned, ...nextGroups.completed];
      const authorIds = allItems.map(item => String(item.createdBy || "")).filter(Boolean);
      // Doplňková data nesmí blokovat již načtené výzvy.
      const [profilesResult, membershipResult] = await Promise.allSettled([
        import("../lib/services/publicProfiles").then(({ getPublicProfiles }) => getPublicProfiles(authorIds)),
        user ? getActiveChallengeIdsForUser(user.uid) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setAuthors(profilesResult.status === "fulfilled" ? profilesResult.value : {});
      setJoinedChallengeIds(new Set(membershipResult.status === "fulfilled" ? membershipResult.value : []));
    }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e : new Error("Výzvy se nepodařilo načíst."));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activityType, monthStart, monthEnd, user]);

  return <>
    <Navbar title="Výzvy" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={item=>{setMenuVisible(false); const routes:any={home:"/",myrun:"/myruns",teams:"/teams",challenges:"/challenges",progress:"/progress",trainer:"/trainer",statistics:"/statistics",participants:"/participants",weather:"/weather",routes:"/routes",settings:"/settings",admin:"/admin"}; router.push(routes[item]||"/");}}/>
    <main className="container challenges-page">
      <header className="teams-header"><span className="teams-eyebrow">SOUTĚŽ A MOTIVACE</span><h1>Výzvy</h1><p>Zapoj se do výzvy nebo vytvoř vlastní.</p></header>
      {!showCreate ? (
        <button type="button" className="run-primary-button challenges-create-launch" onClick={() => setShowCreate(true)}>
          <Plus size={18}/> Vytvořit výzvu
        </button>
      ) : (
        <section className="tile challenges-create">
          <div className="teams-section-heading">
            <div><h2>Vytvořit výzvu</h2><p>Výzvy jsou veřejné a po vytvoření se automaticky účastníš.</p></div>
            <button type="button" className="ui-icon-button" onClick={() => setShowCreate(false)} aria-label="Zavřít formulář"><X size={18}/></button>
          </div>
          <div className="teams-create-form professional-form">
            <FormField label="Název výzvy">
              <input className="professional-input" maxLength={40} placeholder="Např. 50 km za listopad" value={name} onChange={e=>setName(e.target.value)}/>
            </FormField>
            <FormField label="Popis" hint="volitelné">
              <textarea className="professional-input" maxLength={200} placeholder="Krátce popiš cíl a motivaci výzvy." value={description} onChange={e=>setDescription(e.target.value)}/>
            </FormField>
            <FormField label="Typ aktivity">
              <ActivityTypeSelector value={activityType} onChange={setActivityType} ariaLabel="Typ aktivity výzvy"/>
            </FormField>
            <FormField label="Typ cíle">
              <select value={kind} onChange={e=>setKind(e.target.value as ChallengeKind)}>
                <option value="distance">Vzdálenost</option>
                <option value="activities">Počet aktivit</option>
                <option value="activeDays">Aktivní dny</option>
                <option value="sharedDistance">Společný cíl</option>
              </select>
            </FormField>
            <FormField label="Cíl">
              <input className="professional-input" type="number" min="1" step={kind==="distance"||kind==="sharedDistance"?"0.1":"1"} placeholder={kind==="distance"||kind==="sharedDistance"?"Např. 50":kind==="activities"?"Např. 10":"Např. 15"} value={goal} onChange={e=>setGoal(e.target.value)}/>
            </FormField>
            <div className="challenge-dates">
              <FormField label="Od"><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></FormField>
              <FormField label="Do"><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></FormField>
            </div>
            <label className="professional-form-file">
              <Plus size={19} aria-hidden="true" />
              <span>{avatarUrl ? "Obrázek vybrán" : "Přidat obrázek"}</span>
              <span className="professional-file-hint">volitelné</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage||creating} onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploadingImage(true);try{const uploaded=await uploadChallengeImage(file);setAvatarUrl(uploaded.secureUrl);setAvatarPublicId(uploaded.publicId);showAppToast("Obrázek byl nahrán.","success");}catch(err){showAppToast(err instanceof Error?err.message:"Obrázek se nepodařilo nahrát.","error");}finally{setUploadingImage(false);}}}/>
            </label>
            {avatarUrl&&<div className="challenge-image-preview"><img src={cloudinaryImageUrl(avatarUrl,160)} alt="Náhled obrázku výzvy"/><button type="button" className="run-secondary-button" onClick={()=>{setAvatarUrl("");setAvatarPublicId("");}}>Odebrat obrázek</button></div>}
            <div className="professional-form-actions">
              <button className="run-primary-button" onClick={()=>void create()} disabled={creating||uploadingImage||!name.trim()||!goal||!startDate||!endDate}><Plus size={18}/>{creating?"Vytvářím…":"Vytvořit výzvu"}</button>
            </div>
          </div>
        </section>
      )}
      <div className="challenge-type-switch"><ActivityTypeSelector value={activityType} onChange={value=>setActivityType(value)} ariaLabel="Filtr typu aktivity" /></div>
      <div className="challenge-month"><button onClick={()=>shift(-1)} aria-label="Předchozí měsíc"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={()=>shift(1)} aria-label="Další měsíc"><ChevronRight/></button></div>
      {loading?<LoadingSkeleton count={4}/>:error?<div className="tile teams-empty">Výzvy se nepodařilo načíst.</div>:([["active",groups.active],["planned",groups.planned],["completed",groups.completed]] as const).map(([state,items])=><section key={state} className="challenge-group"><h2>{state==="active"?"Aktivní":state==="planned"?"Plánované":"Dokončené"}</h2><div className="teams-grid">{items.map(c=><article key={c.id} className="tile team-card challenge-card" onClick={()=>router.push("/challenges/"+c.id)}>
        <div className="team-card-main"><div className="team-avatar">{c.avatarUrl?<img src={cloudinaryImageUrl(c.avatarUrl,96)} alt=""/>:<Target size={22}/>}</div><div className="team-card-info"><div className="team-card-title-row"><h3>{c.name}</h3>{joinedChallengeIds.has(c.id)&&<span className="challenge-participating">Účastníš se</span>}</div>{c.description&&<p className="team-card-description">{c.description}</p>}<p className="team-card-meta">{kindLabel(c.kind)} · {c.activityType==="běh"?"Běh":"Chůze"} · Autor: {authors[String(c.createdBy||"")]?.nickname || "Uživatel"}</p><div className="team-card-stats"><span>{progress(c)}</span><span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span></div></div><ChevronRight className="team-card-chevron" size={20}/></div></article>)}</div></section>)}
      {!loading&&!error&&!groups.active.length&&!groups.planned.length&&!groups.completed.length&&<div className="tile teams-empty"><Trophy size={30}/><strong>V tomto měsíci nejsou žádné výzvy.</strong><p>Zkus jiný měsíc nebo vytvoř vlastní výzvu.</p></div>}
    </main>
  </>;
}
