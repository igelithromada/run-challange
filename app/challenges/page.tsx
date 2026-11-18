"use client";
import { challengeKindFor } from "../lib/challengeMeasurement";
import { isStrengthActivity } from "../lib/activity";
import { preparePhoto } from "../lib/preparePhoto";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { auth } from "../lib/firebase";
import ChallengeSummaryCard from "../components/ChallengeSummaryCard";
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
  if (file.size <= 0) throw new Error("Vybraná fotografie je prázdná.");
  if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
  const token = await auth.currentUser.getIdToken();
  const form = new FormData(); form.append("file", await preparePhoto(file));
  const response = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.secureUrl !== "string") throw new Error(data.error || "Obrázek se nepodařilo nahrát.");
  return { secureUrl: data.secureUrl, publicId: typeof data.publicId === "string" ? data.publicId : "" };
}
import type { ActivityType, ChallengeData, ChallengeKind } from "../types";

const MONTHS = ["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"];

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }

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
  const [joinedChallengeIds,setJoinedChallengeIds]=useState<Set<string>>(new Set());

  useEffect(()=>{ const unsub=onAuthStateChanged(auth,u=>{ if(!u){router.push("/login");return;} setUser(u); try{const v=localStorage.getItem("dolni-lhota-default-activity-v1"); if(v==="běh"||v==="chůze"||v==="dřepy"||v==="kliky")setActivityType(v);}catch{} }); return ()=>unsub(); },[router]);

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
      const data=await request("create",{name,description,kind:challengeKindFor(activityType,kind),activityType,goal:Number(goal),startDate,endDate,avatarUrl,avatarPublicId});
      const createdChallenge = data.challenge as ChallengeData | undefined;
      setName("");setDescription("");setGoal("");setStartDate("");setEndDate("");setAvatarUrl("");setAvatarPublicId("");
      setJoinedChallengeIds(current => new Set([...current, data.id]));
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
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    request("refresh", {}).then(() => Promise.all((["active","planned","completed"] as const).map(async state => {
      const result = await fetchChallengesPage(activityType, state, monthStart, monthEnd, 10);
      return [state, result] as const;
    }))).then(async results => {
      if (cancelled) return;
      const nextGroups = { active: results[0][1].items, planned: results[1][1].items, completed: results[2][1].items };
      setGroups(nextGroups);
      const allItems = [...nextGroups.active, ...nextGroups.planned, ...nextGroups.completed];
      const joinedIds = await getActiveChallengeIdsForUser(user.uid, allItems.map(item => item.id));
      if (!cancelled) setJoinedChallengeIds(new Set(joinedIds));
    }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e : new Error("Výzvy se nepodařilo načíst."));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activityType, monthStart, monthEnd, user]);

  return <>
    <Navbar title="Výzvy" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)}/>
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
              <input className="professional-input" maxLength={40} placeholder={isStrengthActivity(activityType) ? "Např. 500 opakování za měsíc" : "Např. 50 km za listopad"} value={name} onChange={e=>setName(e.target.value)}/>
            </FormField>
            <FormField label="Popis" hint="volitelné">
              <textarea className="professional-input" maxLength={200} placeholder="Krátce popiš cíl a motivaci výzvy." value={description} onChange={e=>setDescription(e.target.value)}/>
            </FormField>
            <FormField label="Typ aktivity">
              <ActivityTypeSelector value={activityType} onChange={setActivityType} ariaLabel="Typ aktivity výzvy"/>
            </FormField>
            <FormField label="Typ cíle">
              <select value={kind} onChange={e=>setKind(e.target.value as ChallengeKind)}>
                <option value="distance">{isStrengthActivity(activityType) ? "Počet opakování" : "Vzdálenost"}</option>
                <option value="activities">Počet aktivit</option>
                <option value="activeDays">Aktivní dny</option>
                <option value="sharedDistance">Společný cíl</option>
              </select>
            </FormField>
            <FormField label={"Cíl (" + (kind === "activities" ? "aktivit" : kind === "activeDays" ? "dnů" : isStrengthActivity(activityType) ? "opakování" : "km") + ")"}>
              <input className="professional-input" type="number" min="1" step={!isStrengthActivity(activityType) && (kind==="distance"||kind==="sharedDistance")?"0.1":"1"} placeholder={kind==="distance"||kind==="sharedDistance"?"Např. 50":kind==="activities"?"Např. 10":"Např. 15"} value={goal} onChange={e=>setGoal(e.target.value)}/>
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
      {loading?<LoadingSkeleton count={4}/>:error?<div className="tile teams-empty">Výzvy se nepodařilo načíst.</div>:([["active",groups.active],["planned",groups.planned],["completed",groups.completed]] as const).map(([state,items])=><section key={state} className="challenge-group"><h2>{state==="active"?"Aktivní":state==="planned"?"Plánované":"Dokončené"}</h2><div className="teams-grid">{items.map(c => <ChallengeSummaryCard key={c.id} challenge={c} joined={joinedChallengeIds.has(c.id)} />)}</div></section>)}
      {!loading&&!error&&!groups.active.length&&!groups.planned.length&&!groups.completed.length&&<div className="tile teams-empty"><Trophy size={30}/><strong>V tomto měsíci nejsou žádné výzvy.</strong><p>Zkus jiný měsíc nebo vytvoř vlastní výzvu.</p></div>}
    </main>
  </>;
}
