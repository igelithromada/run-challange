"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Save, Target, TrendingUp } from "lucide-react";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";

type Activity={id:string;uid?:string;km?:number|string;type?:string;timestamp?:any};
type Plan={monthKey:string;type:ActivityType;dates:string[];dayKm:Record<string,number>;monthlyKm:number;createdAt?:string};
type OldPlan={weekKey?:string;type?:ActivityType;days?:number[];dayKm?:Record<string,number>;weeklyKm?:number};

const monthKeyOf=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const activityDate=(r:Activity)=>{const v=r.timestamp?.seconds?r.timestamp.seconds*1000:r.timestamp?.toDate?r.timestamp.toDate().getTime():Number(r.timestamp)||0;return new Date(v);};
const monthTitle=(d:Date)=>d.toLocaleDateString("cs-CZ",{month:"long",year:"numeric"});
const monday=(d:Date)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};

export default function TrainerPage(){
 const router=useRouter();
 const [menuVisible,setMenuVisible]=useState(false);
 const [uid,setUid]=useState("");
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [plan,setPlan]=useState<Plan|null>(null);
 const [dates,setDates]=useState<string[]>([]);
 const [dayKm,setDayKm]=useState<Record<string,string>>({});
 const [selectedDate,setSelectedDate]=useState("");
 const [type,setType]=useState<ActivityType>("běh");
 const [runs,setRuns]=useState<Activity[]>([]);
 const [monthlyGoal,setMonthlyGoal]=useState(100);
 const [dirty,setDirty]=useState(false);
 const [modalOpen,setModalOpen]=useState(false);
 const [loading,setLoading]=useState(true);
 const currentMonth=monthKeyOf(month);

 useEffect(()=>onAuthStateChanged(auth,async user=>{
   if(!user){router.push("/login");return;}
   setUid(user.uid);
   try{
     const profile=await getDoc(doc(db,"users",user.uid));
     const data=profile.exists()?profile.data():{};
     const stored=data.personalTrainerPlan as Plan|OldPlan|undefined;
     const runSnap=await getDocs(query(collection(db,"runs"),where("uid","==",user.uid)));
     const loaded=runSnap.docs.map(d=>({id:d.id,...d.data()} as Activity));
     setRuns(loaded);
     const goalType=(stored as any)?.type||"běh";
     const goals=data.progressGoalsByType||{};
     setMonthlyGoal(num(goals[goalType]?.monthly??data.progressGoals?.monthly??100)||100);
     if(stored&&"monthKey" in stored&&stored.monthKey===currentMonth){
       const p=stored as Plan;
       setPlan(p);setType(p.type||"běh");setDates(Array.isArray(p.dates)?p.dates:[]);
       setDayKm(Object.fromEntries((p.dates||[]).map(d=>[d,String(p.dayKm?.[d]??5)])));
       setSelectedDate(p.dates?.[0]||dateKey(month));
     }else{
       setPlan(null);setDates([]);setDayKm({});
       setType((stored as any)?.type==="chůze"?"chůze":"běh");
       setSelectedDate(dateKey(month));
     }
   }catch(e){console.error("Nepodařilo se načíst osobního trenéra",e);}
   finally{setLoading(false);}
 }),[router,currentMonth]);

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
 const percent=plannedTotal?Math.min(100,completed/plannedTotal*100):0;
 const selectedInfo=selectedDate?cellInfo(new Date(selectedDate+"T00:00:00")):cellInfo(new Date());

 const todayKey=dateKey(new Date());
 const selectedIsPast=!!selectedDate && selectedDate<todayKey;
 const selectedKmValue=dayKm[selectedDate]??"";
 const saveSelected=async()=>{
   if(!uid||!selectedDate||selectedIsPast)return;
   const value=Math.max(0,num(selectedKmValue));
   if(value<=0)return;
   const nextDates=dates.includes(selectedDate)?dates:[...dates,selectedDate].sort();
   const nextDayKm={...dayKm,[selectedDate]:String(value)};
   const next:Plan={monthKey:currentMonth,type,dates:nextDates,dayKm:Object.fromEntries(nextDates.map(d=>[d,Math.max(.5,num(nextDayKm[d]))])),monthlyKm:nextDates.reduce((s,d)=>s+num(nextDayKm[d]),0),createdAt:plan?.createdAt||new Date().toISOString()};
   await setDoc(doc(db,"users",uid),{personalTrainerPlan:next},{merge:true});
   setPlan(next);setDates(nextDates);setDayKm(nextDayKm);setDirty(false);
 };
 const updateSelectedKm=(value:string)=>{if(!selectedIsPast){setDayKm(cur=>({...cur,[selectedDate]:value}));setDirty(true);}};

 const openDayEditor=(key:string)=>{\n   const d=new Date(key+"T00:00:00");\n   if(d.getMonth()!==month.getMonth()||d.getFullYear()!==month.getFullYear())return;\n   setSelectedDate(key);\n   setModalOpen(true);\n   setDirty(false);\n };\n\n const handleSelect=async(item:string)=>{
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
    <ActivityTypeSelector value={type} onChange={v=>{setType(v);setDirty(true);}} ariaLabel="Typ tréninku"/>
    <div className="trainer-month-nav">
      <button className="ui-icon-button" type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} aria-label="Předchozí měsíc"><ChevronLeft size={19}/></button>
      <strong>{monthTitle(month)}</strong>
      <button className="ui-icon-button" type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} aria-label="Další měsíc"><ChevronRight size={19}/></button>
    </div>
    <div className="trainer-calendar-weekdays">{["Po","Út","St","Čt","Pá","So","Ne"].map(d=><span key={d}>{d}</span>)}</div>
    <div className="trainer-calendar">
      {weeks.map((week,i)=><div className="trainer-calendar-week" key={i}>{week.map(d=>{
        const s=cellInfo(d);
        return <button type="button" key={s.key} className={`trainer-calendar-day ${s.inMonth?"":"outside"} ${s.selected?"selected":""} ${s.status} ${s.key<todayKey?"past":""}`} onClick={()=>openDayEditor(s.key)}>
          <span>{d.getDate()}</span>{s.selected&&<small>{s.target.toFixed(1)} km</small>}{s.selected&&s.status==="done"&&<Check size={14}/>}
        </button>
      })}</div>)}
    </div>

    <div className="trainer-selected-day">
      <div><span className="trainer-selected-label">Vybraný den</span><strong>{selectedInfo.key?new Date(selectedInfo.key+"T00:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"long"}):"—"}</strong></div>
      <span className={`trainer-day-status ${selectedInfo.status}`}>{selectedInfo.selected?(selectedInfo.status==="done"?"Splněno":selectedInfo.status==="partial"?"Částečně":selectedInfo.status==="missed"?"Nesplněno":"Naplánováno"):"Bez plánu"}</span>
    </div>
    {selectedIsPast ? <div className="trainer-day-readonly">
      <strong>Ukončený den</strong><span>{selectedInfo.selected ? selectedInfo.actual.toFixed(1)+" / "+selectedInfo.target.toFixed(1)+" km" : "Pro tento den není možné zpětně nastavovat ani měnit plán."}</span>
    </div> : <div className="trainer-day-editor-month">
      <label><span>Cíl dne (km)</span><input type="number" min=".5" step=".5" placeholder="např. 5" value={selectedKmValue} onChange={e=>updateSelectedKm(e.target.value)}/></label>
      <button type="button" className="progress-save" disabled={!selectedKmValue||num(selectedKmValue)<=0||!dirty} onClick={()=>void saveSelected()}><Save size={17}/> Uložit</button>
    </div>}

    {modalOpen && <div className="trainer-day-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="trainer-day-modal-title">\n      <div className="trainer-day-modal">\n        <div className="trainer-day-modal-header">\n          <div><span>Vybraný den</span><h3 id="trainer-day-modal-title">{selectedDate?new Date(selectedDate+"T00:00:00").toLocaleDateString("cs-CZ",{weekday:"long",day:"numeric",month:"long"}):"—"}</h3></div>\n          <button type="button" className="ui-icon-button" onClick={()=>setModalOpen(false)} aria-label="Zavřít">×</button>\n        </div>\n        {selectedIsPast ? <div className="trainer-day-readonly"><strong>Ukončený den</strong><span>{selectedInfo.selected ? selectedInfo.actual.toFixed(1)+" / "+selectedInfo.target.toFixed(1)+" km" : "Tento den už nelze měnit."}</span></div> : <div className="trainer-day-modal-form">\n          <label><span>Cíl dne</span><div className="trainer-km-field"><input autoFocus type="number" min=".5" step=".5" inputMode="decimal" placeholder="5" value={selectedKmValue} onChange={e=>updateSelectedKm(e.target.value)}/><b>km</b></div></label>\n          <div className="trainer-day-modal-actions"><button type="button" className="trainer-secondary-button" onClick={()=>setModalOpen(false)}>Zrušit</button><button type="button" className="progress-save" disabled={!selectedKmValue||num(selectedKmValue)<=0} onClick={async()=>{await saveSelected();setModalOpen(false);}}><Save size={17}/> Uložit</button></div>\n        </div>}\n      </div>\n    </div>}\n\n    <div className="trainer-plan-footer"><div><span>Objem měsíce</span><strong>{plannedTotal.toFixed(1)} km</strong></div><div><span>Měsíční cíl</span><strong>{monthlyGoal.toFixed(0)} km</strong></div><div><span>Plnění</span><strong>{percent.toFixed(0)} %</strong></div>
    </div>
   </section>

   <section className="tile trainer-summary-card">
    <div className="progress-section-title"><Target/><div><h2>Plnění měsíce</h2><p>Počítají se pouze aktivity stejného typu jako plán.</p></div></div>
    <div className="trainer-score"><div><span>{completed.toFixed(1)} / {plannedTotal.toFixed(1)} km</span><strong>{percent.toFixed(0)} %</strong></div><div className="progress-track"><i style={{width:`${percent}%`}}/></div></div>
    <div className="trainer-stats"><div><span>Naplánované dny</span><strong>{dates.length}</strong></div><div><span>Plán vs. měsíční cíl</span><strong>{monthlyGoal?Math.min(100,plannedTotal/monthlyGoal*100).toFixed(0):0} %</strong></div></div>
    <p className="trainer-goal-note">Na kalendáři okamžitě vidíš, které dny jsou naplánované a jak se daří jejich plnění.</p>
   </section>

  </main>
 </>
}
