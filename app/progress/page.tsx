"use client";
import Metric from "../components/Metric";
import { activityAmount, activityUnit, isStrengthActivity } from "../lib/activity";

import React, { useEffect, useMemo, useState } from "react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Award, CalendarDays, Footprints, Medal, Trophy, CheckCircle2, Lock, Zap, Flame } from "lucide-react";
import { auth } from "../lib/firebase";
import { parseActivityDate } from "../lib/runData";
import { activityAwards, awardTotal, type Award as ProgressAward } from "../lib/awards";
import ActivityCalendar from "../components/ActivityCalendar";
import ProgressChart from "../components/ProgressChart";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import type { RunData } from "../types";
import { personalHistoryQuery } from "../lib/services/runs";

type ProgressActivity = RunData;
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
function AwardSection({ title, awards, icon }: { title: string; awards: ProgressAward[]; icon: React.ReactNode }) {
  const repeatable = awards.some(award => award.repeatable);
  const summary = repeatable ? `Získáno ${awardTotal(awards)}×`
    : `Splněno ${awards.filter(award => award.count > 0).length} z ${awards.length}`;
  return <section className="progress-section">
    <div className="progress-section-title">{icon}<div><h2>{title}</h2><p>{summary}</p></div></div>
    <div className="progress-badges-scroll" role="group" tabIndex={0} aria-label={title}>
      {awards.map(award => <article key={award.id} className={award.count > 0 ? "progress-badge earned" : "progress-badge locked"}>
        <span aria-hidden="true">{award.icon}</span>
        <div><strong>{award.title} {repeatable && <b className="award-count">{award.count}×</b>}</strong><p>{award.detail}</p></div>
        {award.count > 0 ? <CheckCircle2 size={18} aria-label="Získáno"/> : <Lock size={17} aria-label="Zatím nezískáno"/>}
      </article>)}
    </div>
  </section>;
}

export default function ProgressPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [goalType, setGoalType] = useState<ActivityType>("běh");
 useEffect(() => {
   try {
     const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
     if (cached === "běh" || cached === "chůze" || cached === "dřepy" || cached === "kliky") setGoalType(cached);
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
  const strength = isStrengthActivity(goalType), unit = activityUnit(goalType);
  const allKm = selected.reduce((sum, run) => sum + activityAmount(run), 0);

  const sorted = [...selected].sort((a,b) => activityDate(a).getTime()-activityDate(b).getTime());
  const longest = sorted.reduce<ProgressActivity | null>((best, run) => !best || activityAmount(run)>activityAmount(best) ? run : best, null);
  const fastest = sorted.filter(run => asNumber(run.tempo)>0).reduce<ProgressActivity | null>((best, run) => !best || asNumber(run.tempo)<asNumber(best.tempo) ? run : best, null);
  const dailyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) dailyTotals.set(dateKey(d),(dailyTotals.get(dateKey(d))||0)+activityAmount(run)); });
  const monthlyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) { const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; monthlyTotals.set(key,(monthlyTotals.get(key)||0)+activityAmount(run)); } });
  const bestMonth = Math.max(0, ...Array.from(monthlyTotals.values()));
  const bestMonthKey = Array.from(monthlyTotals.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const streak = (() => {
    let count=0; const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if (!dailyTotals.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    while (dailyTotals.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate()-1); }
    return count;
  })();

  const activityWord = goalType === "chůze" ? "chodec" : "běžec";
  const baseLevels = [
    { name:"Začátečník", min:0, next:25, icon:"🌱" },
    { name:`Pravidelný ${activityWord}`, min:25, next:100, icon:"👟" },
    { name:"Pokročilý", min:100, next:250, icon:"🔥" },
    { name:`Zkušený ${activityWord}`, min:250, next:500, icon:"🏅" },
    { name:`${goalType === "chůze" ? "Chodecký" : "Běžecký"} matador`, min:500, next:1000, icon:"🏆" },
    { name:"Legenda", min:1000, next:2000, icon:"👑" },
    { name:"Legenda 2.0", min:2000, next:5000, icon:"💎" }
  ];
  const levels = strength ? baseLevels.map((item, index) => ({...item, name:["Začátečník","Pravidelný trénink","Pokročilý","Zkušený sportovec","Silový matador","Legenda","Legenda 2.0"][index], min:item.min*10,next:item.next*10})) : baseLevels;
  const level = [...levels].reverse().find(item => allKm >= item.min) || levels[0];
  const levelProgress = Math.min(100, Math.max(0, (allKm - level.min) / (level.next - level.min) * 100));

  const levelNumber = levels.indexOf(level) + 1;
  const nextLevel = levels[levelNumber];
  const remaining = Math.max(0, level.next - allKm);
  const experienceAmount = (amount: number) => amount.toLocaleString("cs-CZ", { maximumFractionDigits: strength ? 0 : 2 }) + " " + unit;
  const awards = useMemo(() => activityAwards(selected, goalType), [selected, goalType]);
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


      <ProgressChart key={goalType} runs={selected} activityType={goalType} loading={personalState.loading} error={!!personalState.error} />

      <section className="progress-level tile progress-experience">
        <div className="progress-section-title"><Medal/><div><h2>Zkušenosti</h2></div></div>
        <div className="progress-experience-main">
          <span className="progress-level-emoji" aria-hidden="true">{level.icon}</span>
          <div><small>Úroveň {levelNumber} / {levels.length}</small><h3>{level.name}</h3></div>
          <strong>{experienceAmount(allKm)}<small>Celkem</small></strong>
        </div>
        <div className="progress-experience-target">
          <span>{nextLevel ? `Další úroveň: ${nextLevel.name}` : "Milník nejvyšší úrovně"}</span>
          <strong>{experienceAmount(level.next)}</strong>
        </div>
        <progress max={100} value={levelProgress} aria-label="Postup v aktuální úrovni" />
        <div className="progress-level-foot">
          <span>{remaining ? `Zbývá ${experienceAmount(remaining)}` : "Milník splněn"}</span>
          <strong>{Math.round(levelProgress)} %</strong>
        </div>
      </section>

      <AwardSection title="Odznaky" awards={awards.filter(award => award.repeatable)} icon={<Award/>} />
      <AwardSection title="Úspěchy" awards={awards.filter(award => !award.repeatable)} icon={<Trophy/>} />

      <ActivityCalendar key={goalType} runs={selected} activityType={goalType} />

      <section className="tile progress-records">
        <div className="progress-section-title"><Trophy/><div><h2>Osobní rekordy</h2><p>Nejlepší výkony v kategorii {goalType}.</p></div></div>
        <div className="progress-record-grid">
          <Metric className="progress-record-item progress-record" icon={<Footprints size={20}/>} label={strength ? "Nejvíce v jedné aktivitě" : "Nejdelší aktivita"} value={<> {longest?activityAmount(longest).toLocaleString("cs-CZ")+" "+unit:"—"}</>} detail={<> {longest?activityDate(longest).toLocaleDateString("cs-CZ"):"Zatím bez aktivity"}</>}/>
          {!strength && <Metric className="progress-record-item progress-record" icon={<Zap size={20}/>} label="Nejrychlejší tempo" value={<> {fastest?formatPace(asNumber(fastest.tempo)):"—"}</>} detail={<> {fastest?activityDate(fastest).toLocaleDateString("cs-CZ"):"Zatím bez aktivity"}</>}/>}
          <Metric className="progress-record-item progress-record" icon={<CalendarDays size={20}/>} label="Nejvíce za měsíc" value={<> {bestMonth.toFixed(strength ? 0 : 1)} {unit}</>} detail={<> {bestMonthKey?new Date(bestMonthKey+"-01T12:00:00").toLocaleDateString("cs-CZ",{month:"long",year:"numeric"}):"Zatím bez aktivity"}</>}/>
          <Metric className="progress-record-item progress-record" icon={<Flame size={20}/>} label="Aktuální série" value={<> {streak} {streak===1?"den":"dní"}</>} detail={<> Aktivní dny za sebou</>}/>
        </div>
      </section>

      {personalState.loading && <LoadingSkeleton count={2} />}
    </main>
  </>;
}
