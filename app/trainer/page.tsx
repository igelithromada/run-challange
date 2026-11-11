"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Save, Target, TrendingUp } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import { getUserProfile } from "../lib/services/users";
import type { RunData, LegacyTrainerPlan } from "../types";
import { userRunsForDateRangeQuery } from "../lib/services/runs";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";

type Activity = Pick<RunData, "id" | "uid" | "km" | "type" | "timestamp">;
type Plan = { monthKey:string; type:ActivityType; dates:string[]; dayKm:Record<string, number | string>; monthlyKm:number; createdAt?:string };
type OldPlan = LegacyTrainerPlan;

const monthKeyOf=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const activityDate=(r:Activity)=>{const v=r.timestamp; if(!v)return new Date(0); if(v instanceof Date)return v; if("toDate" in v&&typeof v.toDate==="function")return v.toDate(); if("seconds" in v&&typeof v.seconds==="number")return new Date(v.seconds*1000); return new Date(0);};
const monthTitle=(d:Date)=>d.toLocaleDateString("cs-CZ",{month:"long",year:"numeric"});
const monday=(d:Date)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};

export default function TrainerPage(){
 const router=useRouter();
 const [menuVisible,setMenuVisible]=useState(false);
 const [uid,setUid]=useState("");
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [plan,setPlan]=useState<Plan|null>(null);
 const [plansByKey,setPlansByKey]=useState<Record<string,Plan>>({});
 const [dates,setDates]=useState<string[]>([]);
 const [dayKm,setDayKm]=useState<Record<string,string>>({});
 const [selectedDate,setSelectedDate]=useState("");
 const [type,setType]=useState<ActivityType>("běh");
 const [profileLoading,setProfileLoading]=useState(true);
 const [monthlyGoal,setMonthlyGoal]=useState(100);
 const [goalsByType,setGoalsByType]=useState<Record<ActivityType,number>>({běh:100,chůze:100});
 const [dirty,setDirty]=useState(false);
 const [modalOpen,setModalOpen]=useState(false);
 const [bulkMode,setBulkMode]=useState(false);
 const [bulkDates,setBulkDates]=useState<string[]>([]);
 const [bulkKm,setBulkKm]=useState("5");
 const [quickInfo,setQuickInfo]=useState<{key:string;status:string;target:number;actual:number;x:number;y:number}|null>(null);
 const longPressTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const longPressTriggered=useRef(false);
 const currentMonth=monthKeyOf(month);

 useEffect(()=>{
   if(!modalOpen)return;
   const viewport=window.visualViewport;
   if(!viewport)return;
   const updateViewport=()=>{
     document.documentElement.style.setProperty("--trainer-vv-top",`${viewport.offsetTop}px`);
     document.documentElement.style.setProperty("--trainer-vv-height",`${viewport.height}px`);
   };
   updateViewport();
   viewport.addEventListener("resize",updateViewport);
   viewport.addEventListener("scroll",updateViewport);
   return()=>{
     viewport.removeEventListener("resize",updateViewport);
     viewport.removeEventListener("scroll",updateViewport);
     document.documentElement.style.removeProperty("--trainer-vv-top");
     document.documentElement.style.removeProperty("--trainer-vv-height");
   };
 },[modalOpen]);

 useEffect(()=>{
   let active=true;
   const unsubscribe=onAuthStateChanged(auth,async user=>{
     if(!active)return;
     if(!user){router.push("/login");return;}
     setUid(user.uid);
     try{
       const data=await getUserProfile(user.uid);
       if(!active)return;
       if (!data) { setProfileLoading(false); return; }
       const storedLegacy=(data?.personalTrainerPlan as Plan|OldPlan|undefined);
       const storedPlans=data?.personalTrainerPlans&&typeof data.personalTrainerPlans==="object"?data.personalTrainerPlans:{};
       const normalized:Record<string,Plan>={};
       for(const activityType of ["běh","chůze"] as ActivityType[]){
         const byMonth=storedPlans[activityType]&&typeof storedPlans[activityType]==="object"?storedPlans[activityType]:{};
         for(const [key,value] of Object.entries(byMonth)){
           const p=value as Partial<Plan>;
           if(p&&typeof p==="object"&&p.monthKey===key&&p.type===activityType) normalized[activityType+"|"+key]=p as Plan;
         }
       }
       if(Object.keys(normalized).length===0&&storedLegacy&&"monthKey" in storedLegacy&&storedLegacy.monthKey){
         normalized[(storedLegacy.type||"běh")+"|"+storedLegacy.monthKey]=storedLegacy as Plan;
       }
       setPlansByKey(normalized);
       const goals=data?.progressGoalsByType||{};
       const nextGoals={běh:num(goals.běh?.monthly??(data.progressGoals?.type==="běh"?data.progressGoals?.monthly:100))||100,chůze:num(goals.chůze?.monthly??(data.progressGoals?.type==="chůze"?data.progressGoals?.monthly:100))||100};
       setGoalsByType(nextGoals);
       setMonthlyGoal(nextGoals[type]);
     }catch(e){
       if(active)console.error("Nepodařilo se načíst osobního trenéra",e);
     }finally{
       if(active)setProfileLoading(false);
     }
   });
   return()=>{active=false;unsubscribe();};
 },[router]);

 const runsQuery = useMemo(() => {
   const start = new Date(month.getFullYear(), month.getMonth(), 1);
   const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
   return userRunsForDateRangeQuery(uid || "__no_user__", start, end);
 }, [uid, month]);
 const runsState = useSharedFirestoreQuery<Activity>(`trainer:runs:${uid || "none"}:${currentMonth}`, runsQuery);
 const runs = runsState.data;
 const loading = profileLoading || runsState.loading;


 useEffect(()=>{
   const key=type+"|"+currentMonth;
   const p=plansByKey[key]||null;
   setPlan(p);
   setDates(Array.isArray(p?.dates)?p!.dates:[]);
   setDayKm(p?Object.fromEntries((p.dates||[]).map(d=>[d,String(p.dayKm?.[d]??"")])):{});
   setSelectedDate(dateKey(month));
   setBulkDates([]);
   setBulkMode(false);
 },[type,currentMonth,plansByKey]);

 useEffect(()=>{setMonthlyGoal(goalsByType[type]||100);},[type,goalsByType]);

 useEffect(()=>{ if(!selectedDate||!selectedDate.startsWith(currentMonth)) setSelectedDate(dateKey(month)); },[currentMonth,selectedDate,month]);

 const actualFor=(key:string)=>runs.filter(r=>(r.type||"běh")===type&&dateKey(activityDate(r))===key).reduce((s,r)=>s+num(r.km),0);
 const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const calendarStart=monday(new Date(month.getFullYear(),month.getMonth(),1));
 const calendarEnd=new Date(month.getFullYear(),month.getMonth(),daysInMonth);
 const calendar:Date[]=[];
 for(let d=new Date(calendarStart);d<=calendarEnd||d.getDay()!==1;d.setDate(d.getDate()+1)){
   calendar.push(new Date(d));
   if(calendar.length>42)break;
 }
 const weeks=Array.from({length:Math.ceil(calendar.length/7)},(_,i)=>calendar.slice(i*7,i*7+7));
 const cellInfo=(d:Date)=>{
   const key=dateKey(d), selected=dates.includes(key), target=num(dayKm[key]), actual=actualFor(key), inMonth=d.getMonth()===month.getMonth();
   const todayKey=dateKey(new Date());
   const status=!selected?"off":actual>=target&&target>0?"done":actual>0?"partial":key<todayKey?"missed":"waiting";
   return {key,selected,target,actual,inMonth,status};
 };
 const plannedTotal=dates.reduce((s,d)=>s+num(dayKm[d]),0);
 const completed=dates.reduce((s,d)=>s+Math.min(actualFor(d),num(dayKm[d])),0);
 const monthActualTotal=runs.filter(r=>(r.type||"běh")===type&&monthKeyOf(activityDate(r))===currentMonth).reduce((s,r)=>s+num(r.km),0);
 const percent=monthlyGoal?Math.min(100,monthActualTotal/monthlyGoal*100):0;
 const planPercent=plannedTotal?Math.min(100,completed/plannedTotal*100):0;
 const currentWeekStart=monday(new Date());
 const currentWeekEnd=new Date(currentWeekStart);
 currentWeekEnd.setDate(currentWeekStart.getDate()+6);
 const weekActualTotal=runs.filter(r=>{
   if((r.type||"běh")!==type)return false;
   const d=activityDate(r);
   return d>=currentWeekStart&&d<=new Date(currentWeekEnd.getFullYear(),currentWeekEnd.getMonth(),currentWeekEnd.getDate(),23,59,59);
 }).reduce((s,r)=>s+num(r.km),0);
 const weekPlannedTotal=dates.filter(key=>{const d=new Date(key+"T00:00:00");return d>=currentWeekStart&&d<=currentWeekEnd;}).reduce((s,d)=>s+num(dayKm[d]),0);
 const weekPlanPercent=weekPlannedTotal?Math.min(100,weekActualTotal/weekPlannedTotal*100):0;
 const selectedInfo=selectedDate?cellInfo(new Date(selectedDate+"T00:00:00")):cellInfo(new Date());

 const todayKey=dateKey(new Date());
 const selectedIsPast=!!selectedDate && selectedDate<todayKey;
 const selectedKmValue=dayKm[selectedDate]??"";
 const modalStatus=selectedInfo.selected?selectedInfo.status:(num(selectedKmValue)>0?"draft":"off");
 const statusLabel=(status:string)=>{
   if(status==="done")return "Splněno";
   if(status==="partial")return "Částečně splněno";
   if(status==="missed")return "Nesplněno";
   if(status==="waiting")return "Naplánováno";
   if(status==="draft")return "Připraveno k naplánování";
   return "Volný den";
 };
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState("");
 const planKey=(t:ActivityType,m:string)=>t+"|"+m;
 const persistPlan=async(next:Plan)=>{
   const user=auth.currentUser;
   if(!user) throw new Error("UNAUTHORIZED");
   const token=await user.getIdToken();
   const response=await fetch("/api/trainer/plan",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({plan:next})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok) throw new Error(result?.error||"SAVE_FAILED");
   return (result?.plan||next) as Plan;
 };
 const saveSelected=async()=>{
   if(!uid||!selectedDate||selectedIsPast)return false;
   const value=Math.max(0,num(selectedKmValue));
   if(value<=0)return false;
   setSaving(true);setSaveError("");
   try{
     const nextDates=dates.includes(selectedDate)?dates:[...dates,selectedDate].sort();
     const nextDayKm={...dayKm,[selectedDate]:String(value)};
     const normalizedDayKm=Object.fromEntries(nextDates.map(d=>[d,Math.max(.5,num(nextDayKm[d]))]));
     const next:Plan={monthKey:currentMonth,type,dates:nextDates,dayKm:normalizedDayKm,monthlyKm:nextDates.reduce((s,d)=>s+num(normalizedDayKm[d]),0),createdAt:plan?.createdAt||new Date().toISOString()};
     const savedPlan=await persistPlan(next);
     setPlan(savedPlan);setPlansByKey(cur=>({...cur,[planKey(type,currentMonth)]:savedPlan}));
     setDates(savedPlan.dates);setDayKm(Object.fromEntries(savedPlan.dates.map(d=>[d,String(savedPlan.dayKm?.[d]??"")])));
     setDirty(false);setModalOpen(false);return true;
   }catch(error){setSaveError(error instanceof Error&&error.message?error.message:"Plán se nepodařilo uložit. Zkus to prosím znovu.");return false;}
   finally{setSaving(false);}
 };
 const saveBulk=async()=>{
   const value=Math.max(.5,num(bulkKm));
   const selected=bulkDates.filter(d=>d>=todayKey);
   if(!uid||!selected.length||value<=0)return;
   setSaving(true);setSaveError("");
   try{
     const nextDates=Array.from(new Set([...dates,...selected])).sort();
     const nextDayKm={...dayKm};
     selected.forEach(d=>nextDayKm[d]=String(value));
     const normalizedDayKm=Object.fromEntries(nextDates.map(d=>[d,Math.max(.5,num(nextDayKm[d]))]));
     const next:Plan={monthKey:currentMonth,type,dates:nextDates,dayKm:normalizedDayKm,monthlyKm:nextDates.reduce((s,d)=>s+num(normalizedDayKm[d]),0),createdAt:plan?.createdAt||new Date().toISOString()};
     const savedPlan=await persistPlan(next);
     setPlan(savedPlan);setPlansByKey(cur=>({...cur,[planKey(type,currentMonth)]:savedPlan}));
     setDates(savedPlan.dates);setDayKm(Object.fromEntries(savedPlan.dates.map(d=>[d,String(savedPlan.dayKm?.[d]??"")])));
     setBulkDates([]);setBulkMode(false);
   }catch(error){setSaveError(error instanceof Error&&error.message?error.message:"Hromadné plánování se nepodařilo uložit.");}
   finally{setSaving(false);}
 };

 const updateSelectedKm=(value:string)=>{if(!selectedIsPast){setDayKm(cur=>({...cur,[selectedDate]:value}));setDirty(true);}};

 const openDayEditor=(key:string)=>{
   const d=new Date(key+"T00:00:00");
   if(d.getMonth()!==month.getMonth()||d.getFullYear()!==month.getFullYear())return;
   setSelectedDate(key);
   setModalOpen(true);
   setDirty(false);
 };

 const showQuickInfo=(key:string,x:number,y:number)=>{
   const info=cellInfo(new Date(key+"T00:00:00"));
   setQuickInfo({key,status:info.status,target:info.target,actual:info.actual,x,y});
 };
 const beginLongPress=(key:string,e:React.PointerEvent<HTMLButtonElement>)=>{
   longPressTriggered.current=false;
   if(longPressTimer.current)clearTimeout(longPressTimer.current);
   const x=e.clientX,y=e.clientY;
   longPressTimer.current=setTimeout(()=>{longPressTriggered.current=true;showQuickInfo(key,x,y);},550);
 };
 const cancelLongPress=()=>{
   if(longPressTimer.current){clearTimeout(longPressTimer.current);longPressTimer.current=null;}
   setQuickInfo(null);
 };
 const handleDayClick=(s:ReturnType<typeof cellInfo>)=>{
   if(longPressTriggered.current){longPressTriggered.current=false;return;}
   if(bulkMode){
     if(!s.inMonth||s.key<todayKey)return;
     setBulkDates(cur=>cur.includes(s.key)?cur.filter(d=>d!==s.key):[...cur,s.key].sort());
     return;
   }
   openDayEditor(s.key);
 };
 const handleSelect=async(item:string)=>{
   setMenuVisible(false);if(item==="logout"){await signOut(auth);router.push("/login");return;}
   const routes:Record<string,string>={home:"/",myrun:"/myruns",teams:"/teams",progress:"/progress",trainer:"/trainer",statistics:"/statistics",participants:"/participants",weather:"/weather",settings:"/settings",admin:"/admin"};
   router.push(routes[item]||"/");
 };

 if(loading)return <><Navbar title="Osobní trenér" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile"><p>Načítám osobního trenéra…</p></div></main></>;

 return <>
  <Navbar title="Osobní trenér" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
  <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
  <main className="container progress-page trainer-page">
   <header className="progress-header"><h1>Osobní trenér</h1></header>

   <section className="tile trainer-plan-card">
    <div className="progress-section-title"><TrendingUp/><div><h2>Plán na měsíc</h2><p>{monthTitle(month)} · {type}</p></div></div>
    <ActivityTypeSelector value={type} onChange={v=>{setType(v);setDirty(false);setModalOpen(false);setBulkMode(false);setBulkDates([]);}} ariaLabel="Typ tréninku"/>
    <div className="trainer-month-nav">
      <button className="ui-icon-button" type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} aria-label="Předchozí měsíc"><ChevronLeft size={19}/></button>
      <strong>{monthTitle(month)}</strong>
      <button className="ui-icon-button" type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} aria-label="Další měsíc"><ChevronRight size={19}/></button>
    </div>
    <div className="trainer-calendar-weekdays">{["Po","Út","St","Čt","Pá","So","Ne"].map(d=><span key={d}>{d}</span>)}</div>
    <div className="trainer-calendar-toolbar">
      <button type="button" className={`trainer-bulk-toggle ${bulkMode?"active":""}`} onClick={()=>{setBulkMode(v=>!v);setBulkDates([]);setModalOpen(false);}}>
        {bulkMode?"Zrušit výběr":"☑ Hromadně"}
      </button>
      {bulkMode&&<span>Vyber dny, které chceš naplánovat</span>}
    </div>
    <div className={`trainer-calendar ${bulkMode?"bulk-mode":""}`}>
      {weeks.map((week,i)=><div className="trainer-calendar-week" key={i}>{week.map(d=>{
        const s=cellInfo(d), bulkSelected=bulkDates.includes(s.key);
        return <button type="button" key={s.key} className={`trainer-calendar-day ${s.inMonth?"":"outside"} ${s.selected?"selected":""} ${s.status} ${s.key<todayKey?"past":""} ${bulkSelected?"bulk-selected":""}`}
          onPointerDown={e=>beginLongPress(s.key,e)} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
          onContextMenu={e=>e.preventDefault()} onClick={()=>handleDayClick(s)}>
          <span>{d.getDate()}</span>{s.selected&&<small>{s.target.toFixed(1)} km</small>}{s.selected&&s.status==="done"&&<Check size={13}/>}
        </button>
      })}</div>)}
    </div>
    {quickInfo&&typeof document!=="undefined"&&createPortal(
      <div className={`trainer-quick-info ${quickInfo.status}`} style={{
        left:`clamp(110px, ${quickInfo.x}px, calc(100vw - 110px))`,
        ["--quick-arrow-x" as string]:`${Math.max(18,Math.min(82,((quickInfo.x-Math.max(110,Math.min(quickInfo.x,window.innerWidth-110))+110)/220)*100))}%`,
        top:`max(78px, ${quickInfo.y-30}px)`
      }}>
        <strong>{statusLabel(quickInfo.status)}</strong>
        {quickInfo.status!=="off"&&<span>Cíl <b>{quickInfo.target.toFixed(1)} km</b> · Splněno <b>{quickInfo.actual.toFixed(1)} km</b></span>}
        {quickInfo.status==="off"&&<span>Den bez naplánovaného tréninku</span>}
      </div>,
      document.body
    )}
    {bulkMode&&<div className="trainer-bulk-panel">
      <div><strong>{bulkDates.length} {bulkDates.length===1?"den":"dny"}</strong><span>Společný cíl pro vybrané dny</span></div>
      <label><span>km / den</span><input type="number" min=".5" step=".5" inputMode="decimal" value={bulkKm} onChange={e=>setBulkKm(e.target.value)}/></label>
      <button type="button" className="progress-save" disabled={!bulkDates.length||saving} onClick={()=>void saveBulk()}><Save size={17}/> {saving?"Ukládám…":"Naplánovat"}</button>
    </div>}

   </section>

   <section className="tile trainer-summary-card">
    <div className="progress-section-title"><Target/><div><h2>Plnění měsíce</h2><p>Souhrn skutečného pohybu a plnění naplánovaných tréninků.</p></div></div>
    <div className="trainer-score"><div><span>{monthActualTotal.toFixed(1)} / {monthlyGoal.toFixed(1)} km</span><strong>{percent.toFixed(0)} %</strong></div><div className="progress-track"><i style={{width:`${percent}%`}}/></div></div>
    <div className="trainer-stats">
      <div><span>Plán měsíce</span><strong>{plannedTotal.toFixed(1)} km</strong></div>
      <div><span>Měsíční cíl</span><strong>{monthlyGoal.toFixed(0)} km</strong></div>
      <div><span>Naplánované dny</span><strong>{dates.length}</strong></div>
      <div><span>Splnění plánu</span><strong>{planPercent.toFixed(0)} %</strong></div>
    </div>
    <div className="trainer-week-summary">
      <div><span>Tento týden</span><strong>{weekActualTotal.toFixed(1)} / {weekPlannedTotal.toFixed(1)} km</strong></div>
      <div><span>Plnění týdne</span><strong>{weekPlanPercent.toFixed(0)} %</strong></div>
    </div>
    <p className="trainer-goal-note">Kalendář zůstává hlavním místem pro plánování. Tady máš souhrn měsíce i aktuálního týdne na jednom místě.</p>
   </section>

  </main>
  {modalOpen && <div className="trainer-day-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="trainer-day-modal-title">
    <div className={`trainer-day-modal ${modalStatus}`}>
      <div className="trainer-day-modal-header">
        <div><span>Vybraný den</span><h3 id="trainer-day-modal-title">{selectedDate?new Date(selectedDate+"T00:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"long"}):"—"}</h3></div>
        <button type="button" className="ui-icon-button" onClick={()=>setModalOpen(false)} aria-label="Zavřít">×</button>
      </div>
      <div className={`trainer-modal-status ${modalStatus}`}><i/>{statusLabel(modalStatus)}{selectedInfo.selected&&modalStatus!=="draft"&&<span> · {selectedInfo.actual.toFixed(1)} / {selectedInfo.target.toFixed(1)} km</span>}</div>
      {selectedIsPast ? <div className="trainer-day-readonly"><strong>{selectedInfo.selected ? statusLabel(selectedInfo.status) : "Volný den"}</strong><span>{selectedInfo.selected ? selectedInfo.actual.toFixed(1)+" / "+selectedInfo.target.toFixed(1)+" km" : "Tento den nebyl naplánovaný."}</span></div> : <div className="trainer-day-modal-form">
        <label><span>Cíl dne</span><div className={`trainer-km-field ${selectedInfo.status}`}><input className={selectedInfo.status} autoFocus type="number" min=".5" step=".5" inputMode="decimal" placeholder="5" value={selectedKmValue} onChange={e=>updateSelectedKm(e.target.value)}/><b>km</b></div></label>
        {saveError&&<p className="trainer-save-error">{saveError}</p>}
        <div className="trainer-day-modal-actions"><button type="button" className={`progress-save trainer-status-action ${modalStatus}`} disabled={!selectedKmValue||num(selectedKmValue)<=0||saving} onClick={()=>void saveSelected()}><Save size={17}/> {saving?"Ukládám…":selectedInfo.selected?"Uložit":"Naplánovat"}</button></div>
      </div>}
    </div>
  </div>}
 </>
}
