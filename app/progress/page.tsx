"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Award, CalendarDays, Footprints, Medal, Trophy, CheckCircle2, Lock, Zap, Flame } from "lucide-react";
import { auth } from "../lib/firebase";
import { parseActivityDate } from "../lib/runData";
import ProgressChart from "../components/ProgressChart";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import type { RunData } from "../types";
import { personalHistoryQuery } from "../lib/services/runs";

type ProgressActivity = Pick<RunData, "id" | "uid" | "km" | "minuty" | "tempo" | "timestamp" | "type">;
const asNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const activityDate = (run: ProgressActivity) => parseActivityDate(run.timestamp) || new Date(0);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const formatPace = (pace: number) => {
  if (!Number.isFinite(pace) || pace <= 0) return "—";
  const seconds = Math.round(pace * 60);
  return `${Math.floor(seconds/60)}′${String(seconds%60).padStart(2,"0")}″ /km`;
};
const mondayOf = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d;
};

export default function ProgressPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [goalType, setGoalType] = useState<ActivityType>("běh");
 useEffect(() => {
   try {
     const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
     if (cached === "běh" || cached === "chůze") setGoalType(cached);
   } catch {}
 }, []);
  useEffect(() => onAuthStateChanged(auth, user => {
    if (!user) { router.push("/login"); return; }
    setUid(user.uid);
  }), [router]);

  const personalQuery = useMemo(() => personalHistoryQuery(uid || "__no_user__"), [uid]);
  const personalState = useSharedFirestoreQuery<ProgressActivity>("personal-history:v2:" + (uid || "none"), personalQuery);
  const mine = useMemo(() => personalState.data, [personalState.data]);
  const selected = useMemo(() => mine.filter(run => (run.type || "běh") === goalType), [mine, goalType]);
  const now = new Date();
  const allKm = selected.reduce((sum, run) => sum + asNumber(run.km), 0);
  const allActivities = selected.length;

  const sorted = [...selected].sort((a,b) => activityDate(a).getTime()-activityDate(b).getTime());
  const longest = sorted.reduce<ProgressActivity | null>((best, run) => !best || asNumber(run.km)>asNumber(best.km) ? run : best, null);
  const fastest = sorted.filter(run => asNumber(run.tempo)>0).reduce<ProgressActivity | null>((best, run) => !best || asNumber(run.tempo)<asNumber(best.tempo) ? run : best, null);
  const dailyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) dailyTotals.set(dateKey(d),(dailyTotals.get(dateKey(d))||0)+asNumber(run.km)); });
  const maxDay = Math.max(0, ...Array.from(dailyTotals.values()));
  const monthlyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) { const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; monthlyTotals.set(key,(monthlyTotals.get(key)||0)+asNumber(run.km)); } });
  const bestMonth = Math.max(0, ...Array.from(monthlyTotals.values()));
  const activityDays = new Set(selected.map(run => dateKey(activityDate(run)))).size;
  const streak = (() => {
    let count=0; const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if (!dailyTotals.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    while (dailyTotals.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate()-1); }
    return count;
  })();

  const activityWord = goalType === "chůze" ? "chodec" : "běžec";
  const levels = [
    { name:"Začátečník", min:0, next:25, icon:"🌱" },
    { name:`Pravidelný ${activityWord}`, min:25, next:100, icon:"👟" },
    { name:"Pokročilý", min:100, next:250, icon:"🔥" },
    { name:`Zkušený ${activityWord}`, min:250, next:500, icon:"🏅" },
    { name:`${goalType === "chůze" ? "Chodecký" : "Běžecký"} matador`, min:500, next:1000, icon:"🏆" },
    { name:"Legenda", min:1000, next:2000, icon:"👑" },
    { name:"Legenda 2.0", min:2000, next:5000, icon:"💎" }
  ];
  const level = [...levels].reverse().find(item => allKm >= item.min) || levels[0];
  const levelProgress = Math.min(100, Math.max(0, allKm / level.next * 100));

  const badges = [
    { title:"První krok", detail:"Zaznamenal/a první aktivitu", icon:"👟", done:allActivities>=1 },
    { title:"Desítka", detail:"Celkem 10 km", icon:"🔟", done:allKm>=10 },
    { title:"Padesátka", detail:"Celkem 50 km", icon:"🥉", done:allKm>=50 },
    { title:"Stovka", detail:"Celkem 100 km", icon:"🥈", done:allKm>=100 },
    { title:"Čtvrt tisíce", detail:"Celkem 250 km", icon:"🥇", done:allKm>=250 },
    { title:"Půlmaratonský měsíc", detail:"100 km za jeden měsíc", icon:"🌙", done:bestMonth>=100 },
    { title:"Pravidelnost", detail:"Aktivita alespoň 7 dní v řadě", icon:"🔥", done:streak>=7 },
    { title:"Deset aktivit", detail:"Zaznamenáno 10 aktivit", icon:"📅", done:allActivities>=10 },
    { title:"Padesát aktivit", detail:"Zaznamenáno 50 aktivit", icon:"💪", done:allActivities>=50 }
  ];
  const calendarDays = (() => {
    const end = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const start = mondayOf(end);
    start.setDate(start.getDate()-77);
    const days: Date[]=[];
    for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) days.push(new Date(d));
    return days;
  })();

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item==="logout") { await signOut(auth); router.push("/login"); }
    else if (item==="home") router.push("/");
    else if (item==="myrun") router.push("/myruns");
    else if (item==="trainer") router.push("/trainer");
    else router.push("/"+item);
  };

  return <>
    <Navbar title="Můj pokrok" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
    <main className="container progress-page">
      <ActivityTypeSelector value={goalType} onChange={setGoalType} ariaLabel="Typ aktivity pro pokrok" />

      <ProgressChart runs={selected} activityType={goalType} loading={personalState.loading} error={!!personalState.error} />

      <section className="progress-level tile">
        <div className="progress-section-title"><Medal/><div><h2>Úrovně a zkušenosti</h2><p>Postupuješ podle celkové vzdálenosti svých aktivit pro zvolenou kategorii.</p></div></div>
        <div className="progress-level-main"><span className="progress-level-emoji">{level.icon}</span><div><span className="progress-level-caption">AKTUÁLNÍ ÚROVEŇ</span><h3>{level.name}</h3><p>{allKm.toFixed(1)} km celkem · další úroveň od {level.next} km</p></div></div>
        <div className="progress-track level-track"><i style={{width:`${levelProgress}%`}}/></div>
        <div className="progress-level-foot"><span>{levelProgress.toFixed(0)} % k další úrovni</span><strong>Zbývá {Math.max(0,level.next-allKm).toFixed(1)} km</strong></div>
      </section>

      <section className="progress-section">
        <div className="progress-section-title"><Award/><div><h2>Odznaky a úspěchy</h2><p>{badges.filter(b=>b.done).length} z {badges.length} získaných odznaků</p></div></div>
        <div className="progress-badges-grid">{badges.map(badge=><article key={badge.title} className={badge.done?"progress-badge earned":"progress-badge locked"}><span>{badge.done?badge.icon:"🔒"}</span><div><strong>{badge.title}</strong><p>{badge.detail}</p></div>{badge.done?<CheckCircle2 size={18}/>:<Lock size={17}/>}</article>)}</div>
      </section>

      <section className="tile progress-calendar">
        <div className="progress-section-title"><CalendarDays/><div><h2>Kalendář aktivit</h2><p>Posledních 12 týdnů pro kategorii {goalType === "chůze" ? "chůzi" : "běh"} – čím sytější zelená, tím větší vzdálenost.</p></div></div>
        <div className="progress-calendar-with-days">
          <div className="progress-calendar-day-labels" aria-hidden="true">{["Po","Út","St","Čt","Pá","So","Ne"].map(day=><span key={day}>{day}</span>)}</div>
          <div className="progress-calendar-grid">{calendarDays.map(day=>{const km=dailyTotals.get(dateKey(day))||0;return <div key={dateKey(day)} className={`progress-day ${km===0?"":km<3?"level-1":km<7?"level-2":km<12?"level-3":"level-4"}`} title={`${day.toLocaleDateString("cs-CZ", {weekday:"long", day:"numeric", month:"numeric",year:"numeric"})}: ${km.toFixed(1)} km`} aria-label={`${day.toLocaleDateString("cs-CZ", {weekday:"long", day:"numeric",month:"numeric"})}: ${km.toFixed(1)} km`}/>})}</div>
        </div>
        <div className="progress-calendar-legend"><span>Méně</span><i/><i/><i/><i/><span>Více</span></div>
        <p className="progress-calendar-summary">{activityDays} aktivních dní · {maxDay.toFixed(1)} km nejvíce za jeden den</p>
      </section>

      <section className="tile progress-records">
        <div className="progress-section-title"><Trophy/><div><h2>Osobní rekordy</h2><p>Nejlepší výkony v kategorii {goalType}.</p></div></div>
        <div className="progress-record-grid">
          <div className="progress-record-item progress-record"><span className="progress-record-icon"><Footprints size={20}/></span><small>Nejdelší aktivita</small><strong>{longest?asNumber(longest.km).toFixed(2)+" km":"—"}</strong></div>
          <div className="progress-record-item progress-record"><span className="progress-record-icon"><Zap size={20}/></span><small>Nejrychlejší tempo</small><strong>{fastest?formatPace(asNumber(fastest.tempo)):"—"}</strong></div>
          <div className="progress-record-item progress-record"><span className="progress-record-icon"><CalendarDays size={20}/></span><small>Nejvíce za měsíc</small><strong>{bestMonth.toFixed(1)} km</strong></div>
          <div className="progress-record-item progress-record"><span className="progress-record-icon"><Flame size={20}/></span><small>Aktuální série</small><strong>{streak} {streak===1?"den":"dní"}</strong></div>
        </div>
      </section>

      {personalState.loading && <LoadingSkeleton count={2} />}
    </main>
  </>;
}
