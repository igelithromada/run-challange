"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Copy, Save, TrendingUp, Target, ArrowLeft } from "lucide-react";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";

type Activity = { id:string; uid?:string; km?:number|string; type?:string; timestamp?:any };
type Plan = { weekKey:string; type:ActivityType; days:number[]; dayKm:Record<string,number>; weeklyKm:number; createdAt?:string };
type HistoryItem = Plan & { completedKm:number; percent:number; status:"done"|"partial"|"missed"; completedSessions:number; closedAt:string };
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const mondayOf=(date:Date)=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d};
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const weekKey=(d:Date)=>dateKey(mondayOf(d));
const activityDate=(r:Activity)=>{const v=r.timestamp?.seconds?r.timestamp.seconds*1000:r.timestamp?.toDate?r.timestamp.toDate().getTime():Number(r.timestamp)||0;return new Date(v)};
const weekRange=(key:string)=>{const d=new Date(key+"T00:00:00");const e=new Date(d);e.setDate(e.getDate()+6);return `${d.getDate()}.${d.getMonth()+1}. – ${e.getDate()}.${e.getMonth()+1}.${e.getFullYear()}`};
const sameWeek=(d:Date,key:string)=>weekKey(d)===key;

export default function TrainerPage(){
 const router=useRouter();
 const [menuVisible,setMenuVisible]=useState(false);
 const [uid,setUid]=useState("");
 const [plan,setPlan]=useState<Plan|null>(null);
 const [history,setHistory]=useState<HistoryItem[]>([]);
 const [days,setDays]=useState<number[]>([0,2,4]);
 const [dayKm,setDayKm]=useState<Record<number,string>>({0:"5",2:"5",4:"5"});
 const [type,setType]=useState<ActivityType>("běh");
 const [dirty,setDirty]=useState(false);
 const [loading,setLoading]=useState(true);
 const [runs,setRuns]=useState<Activity[]>([]);
 const [monthlyGoal,setMonthlyGoal]=useState(100);
 const currentWeek=weekKey(new Date());

 useEffect(()=>onAuthStateChanged(auth,async user=>{
   if(!user){router.push("/login");return}
   setUid(user.uid);
   try{
     const p=await getDoc(doc(db,"users",user.uid));
     const data=p.exists()?p.data():{};
     const stored=data.personalTrainerPlan as Plan|undefined;
     setPlan(stored?.weekKey===currentWeek?stored:null);
     setHistory(Array.isArray(data.personalTrainerHistory)?data.personalTrainerHistory:[]);
     if(stored?.weekKey===currentWeek){
       setType(stored.type||"běh");
       setDays(Array.isArray(stored.days)?stored.days:[]);
       setDayKm(Object.fromEntries((stored.days||[]).map(d=>[d,String(stored.dayKm?.[String(d)]??stored.dayKm?.[d]??5)])));
     } else if(stored?.days){
       setType(stored.type||"běh");
       setDays(stored.days);
       setDayKm(Object.fromEntries(stored.days.map(d=>[d,String(stored.dayKm?.[String(d)]??stored.dayKm?.[d]??5)])));
     }
     const goals=data.progressGoalsByType||{};
     const selected=data.progressGoals?.type==="chůze"?"chůze":type;
     setMonthlyGoal(num(goals[selected]?.monthly??data.progressGoals?.monthly??100)||100);
     const loadedRuns=runSnap.docs.map(d=>({id:d.id,...d.data()} as Activity));
     setRuns(loadedRuns);
     if(stored?.weekKey && stored.weekKey!==currentWeek){
       const oldRuns=loadedRuns.filter(r=>(r.type||"běh")===stored.type&&sameWeek(activityDate(r),stored.weekKey));
       const completed=oldRuns.reduce((s,r)=>s+num(r.km),0);
       const pct=stored.weeklyKm?Math.min(100,completed/stored.weeklyKm*100):0;
       const sessions=stored.days.filter(d=>oldRuns.some(r=>{const ad=activityDate(r);const monday=new Date(stored.weekKey+"T00:00:00");monday.setDate(monday.getDate()+d);return dateKey(ad)===dateKey(monday)})).length;
       const item:HistoryItem={...stored,completedKm:completed,percent:pct,status:pct>=100?"done":pct>0?"partial":"missed",completedSessions:sessions,closedAt:new Date().toISOString()};
       const nextHistory=[item,...(Array.isArray(data.personalTrainerHistory)?data.personalTrainerHistory:[]).filter((h:HistoryItem)=>h.weekKey!==stored.weekKey)].slice(0,52);
       await setDoc(doc(db,"users",user.uid),{personalTrainerHistory:nextHistory,personalTrainerPlan:null},{merge:true});
       setHistory(nextHistory);
       setPlan(null);
     }
   }catch(e){console.error(e)}finally{setLoading(false)}
 }));

 const currentPlanDays=useMemo(()=>days.map(d=>{const date=new Date(mondayOf(new Date()));date.setDate(date.getDate()+d);return date}),[days]);
 const actualFor=(date:Date)=>runs.filter(r=>(r.type||"běh")===type && dateKey(activityDate(r))===dateKey(date)).reduce((s,r)=>s+num(r.km),0);
 const plannedTotal=useMemo(()=>days.reduce((s,d)=>s+Math.max(0,num(dayKm[d]||dayKm[String(d) as any]||0)),0),[days,dayKm]);
 const monthPlanned=useMemo(()=>currentPlanDays.filter(d=>d.getMonth()===new Date().getMonth()).reduce((s,d)=>s+Math.max(0,num(dayKm[d.getDay()-1]||dayKm[d.getDay()-1]||0)),0),[currentPlanDays,dayKm]);
 const statuses=currentPlanDays.map((date,i)=>{const target=Math.max(0,num(dayKm[days[i]]));const actual=actualFor(date);const future=date>new Date(new Date().setHours(23,59,59,999));const status=future?"waiting":actual>=target&&target>0?"done":actual>0?"partial":"missed";return {date,target,actual,status}});
 const completedKm=statuses.reduce((s,x)=>s+Math.min(x.actual,x.target),0);
 const percent=plannedTotal?Math.min(100,completedKm/plannedTotal*100):0;
 const overall=percent>=100?"done":percent>0?"partial":"missed";
 const setDay=(day:number)=>setDays(v=>v.includes(day)?v.filter(x=>x!==day):[...v,day].sort((a,b)=>a-b));
 const setKm=(day:number,value:string)=>setDayKm(v=>({...v,[day]:value}));
 const save=async()=>{
   if(!uid||!days.length||plannedTotal<=0)return;
   const next:Plan={weekKey:currentWeek,type,days,dayKm:Object.fromEntries(days.map(d=>[String(d),Math.max(0,num(dayKm[d]))])),weeklyKm:plannedTotal,createdAt:plan?.createdAt||new Date().toISOString()};
   await setDoc(doc(db,"users",uid),{personalTrainerPlan:next},{merge:true});
   setPlan(next);setDirty(false);
 };
 const closePreviousAndCreate=async()=>{
   if(!uid)return;
   const ref=doc(db,"users",uid);const snap=await getDoc(ref);const data=snap.exists()?snap.data():{};
   const old=data.personalTrainerPlan as Plan|undefined;
   let nextHistory=Array.isArray(data.personalTrainerHistory)?data.personalTrainerHistory:history;
   if(old?.weekKey&&old.weekKey!==currentWeek){
     const oldRuns=runs.filter(r=>(r.type||"běh")===old.type&&sameWeek(activityDate(r),old.weekKey));
     const completed=oldRuns.reduce((s,r)=>s+num(r.km),0);
     const pct=old.weeklyKm?Math.min(100,completed/old.weeklyKm*100):0;
     const sessions=old.days.filter(d=>oldRuns.some(r=>{const ad=activityDate(r);const monday=new Date(old.weekKey+"T00:00:00");monday.setDate(monday.getDate()+d);return dateKey(ad)===dateKey(monday)})).length;
     const item:HistoryItem={...old,completedKm:completed,percent:pct,status:pct>=100?"done":pct>0?"partial":"missed",completedSessions:sessions,closedAt:new Date().toISOString()};
     nextHistory=[item,...nextHistory.filter((h:HistoryItem)=>h.weekKey!==old.weekKey)].slice(0,52);
     await setDoc(ref,{personalTrainerHistory:nextHistory},{merge:true});
     setHistory(nextHistory);
     setPlan(null);
   }
 };
 const usePrevious=async()=>{
   const prev=history[0];if(!prev)return;
   setType(prev.type);setDays(prev.days);setDayKm(Object.fromEntries(prev.days.map(d=>[d,String(prev.dayKm[String(d)]??5)])));setDirty(true);setPlan(null);
 };
 const handleSelect=async(item:string)=>{setMenuVisible(false);if(item==="logout"){await signOut(auth);router.push("/login")}else if(item==="home")router.push("/");else if(item==="myrun")router.push("/myruns");else router.push("/"+item)};

 if(loading)return <><Navbar title="Osobní trenér" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile"><p>Načítám osobního trenéra…</p></div></main></>;

 return <>
 <Navbar title="Osobní trenér" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
 <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
 <main className="container progress-page trainer-page">
  <header className="progress-header"><span className="progress-eyebrow">PLÁN. POHYB. POSUN.</span><h1>Osobní trenér</h1><p>Konkrétní plán na tento týden. Cíl určuješ v „Moje cíle“, trenér určuje cestu.</p></header>

  <section className="tile trainer-plan-card">
   <div className="progress-section-title"><TrendingUp/><div><h2>{plan?"Tento týden":"Nový týdenní plán"}</h2><p>{weekRange(currentWeek)} · {type}</p></div></div>
   <ActivityTypeSelector value={type} onChange={(v)=>{setType(v);setDirty(true)}} ariaLabel="Typ tréninku"/>
   <div className="trainer-days"><span className="trainer-label">Naplánované dny</span><div>{["Po","Út","St","Čt","Pá","So","Ne"].map((d,i)=><button key={d} type="button" className={days.includes(i)?"active":""} onClick={()=>{setDay(i);setDirty(true)}}>{d}</button>)}</div></div>
   <div className="trainer-day-plan">{days.map(day=>{const s=statuses[days.indexOf(day)];return <div className={`trainer-day-row ${s.status}`} key={day}>
     <div className="trainer-day-name"><strong>{["Po","Út","St","Čt","Pá","So","Ne"][day]}</strong><small>{s.date.toLocaleDateString("cs-CZ",{day:"numeric",month:"numeric"})}</small></div>
     <label><input type="number" min="0.1" step="0.5" value={dayKm[day]??""} onChange={e=>{setKm(day,e.target.value);setDirty(true)}}/><span>km</span></label>
     <div className="trainer-day-result">{s.status==="done"?"🟢 Splněno":s.status==="partial"?"🟡 Částečně":s.status==="missed"?"🔴 Nesplněno":"⚪ Čeká"}<small>{s.actual.toFixed(1)} / {s.target.toFixed(1)} km</small></div>
   </div>)}</div>
   <div className="trainer-week-total"><span>Objem plánu</span><strong>{plannedTotal.toFixed(1)} km</strong><small>součet všech naplánovaných dnů</small></div>
   {dirty&&<button type="button" className="progress-save" onClick={()=>void save()}><Save size={17}/>Uložit plán</button>}
   {!plan&&history.length>0&&<button type="button" className="trainer-secondary-button" onClick={()=>void usePrevious()}><Copy size={17}/>Použít minulý plán</button>}
  </section>

  <section className="tile trainer-summary-card">
   <div className="progress-section-title"><Target/><div><h2>Plnění týdne</h2><p>Trenér počítá pouze aktivity stejného typu jako plán.</p></div></div>
   <div className="trainer-score"><div><span>{completedKm.toFixed(1)} / {plannedTotal.toFixed(1)} km</span><strong>{percent.toFixed(0)} %</strong></div><div className="progress-track"><i style={{width:`${percent}%`}}/></div></div>
   <div className="trainer-stats"><div><span>Splněné dny</span><strong>{statuses.filter(s=>s.status==="done").length} / {days.length}</strong></div><div><span>Měsíční cíl</span><strong>{monthlyGoal.toFixed(0)} km</strong></div></div>
   <p className="trainer-goal-note">Tento plán přidává k měsíčnímu cíli {Math.min(plannedTotal,Math.max(0,monthlyGoal)).toFixed(1)} km z aktuálního týdne. Volné aktivity můžeš použít k dorovnání zbytku.</p>
  </section>

  <section className="tile trainer-history-card">
   <div className="progress-section-title"><CalendarDays/><div><h2>Historie trenéra</h2><p>Uzavřené týdny zůstávají uložené pro přehled.</p></div></div>
   {history.length?<div className="trainer-history-list">{history.slice(0,12).map(h=><details key={h.weekKey} className="trainer-history-item"><summary><span>{weekRange(h.weekKey)}</span><b>{h.status==="done"?"🟢 Splněn":h.status==="partial"?"🟡 Částečně":"🔴 Nesplněn"}</b><strong>{h.percent.toFixed(0)} %</strong></summary><div><span>{h.type} · plán {h.weeklyKm.toFixed(1)} km · skutečnost {h.completedKm.toFixed(1)} km · {h.completedSessions}/{h.days.length} dnů</span></div></details>)}</div>:<p className="trainer-empty">Zatím nemáš uzavřený žádný týden.</p>}
  </section>
 </main></>;
}
