"use client";
import EntryFormPanel from "../components/EntryFormPanel";
import { challengeKindFor } from "../lib/challengeMeasurement";
import { isStrengthActivity } from "../lib/activity";
import CoverField, { useCoverDraft } from "../components/CoverField";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import { auth } from "../lib/firebase";
import ChallengeSummaryCard from "../components/ChallengeSummaryCard";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { fetchChallengeList } from "../lib/services/challenges";
import { showAppToast } from "../components/AppToast";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import FormField from "../components/FormField";
import type { ActivityType, ChallengeData, ChallengeKind, ChallengeList, ChallengeState } from "../types";
import styles from "./page.module.css";


const MONTHS = ["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"];

const CHALLENGE_STATES = [
  { value: "active", label: "Aktivní", empty: "V tomto měsíci nejsou žádné aktivní výzvy." },
  { value: "planned", label: "Plánované", empty: "V tomto měsíci nejsou žádné plánované výzvy." },
  { value: "completed", label: "Dokončené", empty: "V tomto měsíci nejsou žádné dokončené výzvy." },
] as const;

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
  const cover = useCoverDraft(user?.uid || "");
  const [selectedState, setSelectedState] = useState<ChallengeState>("active");
  const [lists, setLists] = useState<Record<string, ChallengeList>>({});
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(()=>{ const unsub=onAuthStateChanged(auth,u=>{ setUser(u); if(!u){router.push("/login");return;} try{const v=localStorage.getItem("dolni-lhota-default-activity-v1"); if(v==="běh"||v==="chůze"||v==="dřepy"||v==="kliky")setActivityType(v);}catch{} }); return ()=>unsub(); },[router]);

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
      const data=await request("create",{name,description,kind:challengeKindFor(activityType,kind),activityType,goal:Number(goal),startDate,endDate,...await cover.resolve()});
      const createdChallenge = data.challenge as ChallengeData | undefined;
      setName("");setDescription("");setGoal("");setStartDate("");setEndDate("");cover.reset();
      setLists({});
      setFailedKey(null);
      setLoadAttempt(current => current + 1);
      if (createdChallenge) {
        setSelectedState(createdChallenge.state);
        setActivityType(createdChallenge.activityType);
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

  const uid = user?.uid;
  const listKey = JSON.stringify([uid, activityType, key, selectedState]);
  const list = lists[listKey];
  const selectedTab = CHALLENGE_STATES.find(tab => tab.value === selectedState) ?? CHALLENGE_STATES[0];

  useEffect(() => {
    if (!uid || list || failedKey === listKey) return;
    const controller = new AbortController();
    const { signal } = controller;
    void fetchChallengeList(activityType, selectedState, monthStart, monthEnd, signal)
      .then(result => {
        if (!signal.aborted) setLists(current => ({ ...current, [listKey]: result }));
      })
      .catch(() => {
        if (!signal.aborted) setFailedKey(listKey);
      });
    return () => controller.abort();
  }, [activityType, failedKey, list, listKey, loadAttempt, monthStart, monthEnd, selectedState, uid]);

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
        <EntryFormPanel title="Vytvořit výzvu" description="Výzvy jsou veřejné a po vytvoření se automaticky účastníš." busy={creating} onClose={() => setShowCreate(false)}>
              <FormField label="Název výzvy">
              <input className="professional-input" maxLength={40} placeholder={isStrengthActivity(activityType) ? "Např. 500 opakování za měsíc" : "Např. 50 km za listopad"} value={name} onChange={e=>setName(e.target.value)}/>
            </FormField>
            <FormField label="Popis" hint="volitelné">
              <textarea className="professional-input" maxLength={200} placeholder="Krátce popiš cíl a motivaci výzvy." value={description} onChange={e=>setDescription(e.target.value)}/>
            </FormField>
            <FormField label="Typ aktivity" group>
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
            <CoverField draft={cover} busy={creating}/>
              <div className="professional-form-actions">
              <button className="run-primary-button" onClick={()=>void create()} disabled={creating||!name.trim()||!goal||!startDate||!endDate}><Plus size={18}/>{creating?"Vytvářím…":"Vytvořit výzvu"}</button>
            </div>
          </EntryFormPanel>
      )}
      <div className="challenge-type-switch"><ActivityTypeSelector value={activityType} onChange={value=>setActivityType(value)} ariaLabel="Filtr typu aktivity" /></div>
      <div className="challenge-month"><button onClick={()=>shift(-1)} aria-label="Předchozí měsíc"><ChevronLeft/></button><strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong><button onClick={()=>shift(1)} aria-label="Další měsíc"><ChevronRight/></button></div>
      <div className={`teams-tabs ${styles.stateTabs}`} role="group" aria-label="Stav výzvy">
        {CHALLENGE_STATES.map(tab => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={selectedState === tab.value}
            onClick={() => { setFailedKey(null); setSelectedState(tab.value); }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section aria-label={`${selectedTab.label} výzvy`} aria-busy={!list && failedKey !== listKey}>
        {failedKey === listKey ? (
          <div className="tile teams-empty" role="alert">
            <strong>Výzvy se nepodařilo načíst.</strong>
            <button type="button" className="run-secondary-button" onClick={() => setFailedKey(null)}>
              Zkusit znovu
            </button>
          </div>
        ) : !list ? (
          <LoadingSkeleton count={4} />
        ) : list.items.length ? (
          <div className="teams-grid">
            {list.items.map(challenge => (
              <ChallengeSummaryCard
                key={challenge.id}
                challenge={challenge}
                joined={list.joinedIds.includes(challenge.id)}
              />
            ))}
          </div>
        ) : (
          <div className="tile teams-empty">
            <Target size={30} />
            <strong>{selectedTab.empty}</strong>
            <p>Zkus jiný měsíc nebo typ aktivity.</p>
          </div>
        )}
      </section>
    </main>
  </>;
}
