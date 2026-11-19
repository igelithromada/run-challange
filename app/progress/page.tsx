"use client";
import Metric from "../components/Metric";
import AwardMetrics, { BadgeTotal } from "../components/AwardMetrics";
import { formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { activityAmount, activityUnit, isStrengthActivity, recordActivityType } from "../lib/activity";

import { useEffect, useMemo, useState } from "react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CalendarDays, Gauge, MapPin, Trophy, Flame } from "lucide-react";
import { auth } from "../lib/firebase";
import { parseActivityDate } from "../lib/runData";
import { activityAwards, awardTotal, type Award as ProgressAward } from "../lib/awards";
import ActivityCalendar from "../components/ActivityCalendar";
import ProgressChart from "../components/ProgressChart";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector, { ActivityType, ActivityTypeIcon } from "../components/ActivityTypeSelector";
import type { RunData } from "../types";
import { personalHistoryQuery } from "../lib/services/runs";

type ProgressActivity = RunData;
const asNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
function AwardSection({ title, awards }: { title: string; awards: ProgressAward[] }) {
  const repeatable = awards.some(award => award.repeatable);
  return <section className="tile progress-section progress-records">
    <div className="progress-section-title">
      <div>
        <h2 className="award-heading">{title}{repeatable && <BadgeTotal count={awardTotal(awards)}/>}</h2>
        {!repeatable && <p>Splněno {awards.filter(award => award.count > 0).length} z {awards.length}</p>}
      </div>
    </div>
    <AwardMetrics awards={awards} label={title} scroll={!repeatable}/>
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
  const now = new Date();
  const strength = isStrengthActivity(goalType), unit = activityUnit(goalType);
  const eligible = personalState.data.flatMap(run => {
    if (recordActivityType(run) !== goalType) return [];
    const date = parseActivityDate(run.timestamp);
    const amount = activityAmount(run);
    return date && date <= now && amount > 0 ? [{ run, date, amount }] : [];
  });
  const selected = eligible.map(entry => entry.run);
  const lifetimeAmount = eligible.reduce((sum, entry) => sum + entry.amount, 0);
  const sorted = eligible.sort((a, b) => +a.date - +b.date);
  type Entry = (typeof sorted)[number];
  const longest = sorted.reduce<Entry | null>((best, entry) => !best || entry.amount > best.amount ? entry : best, null);
  const fastest = sorted.filter(({ run }) => asNumber(run.tempo) > 0)
    .reduce<Entry | null>((best, entry) => !best || asNumber(entry.run.tempo) < asNumber(best.run.tempo) ? entry : best, null);
  const activeDays = new Set<string>();
  const monthlyTotals = new Map<string, number>();
  for (const { date, amount } of sorted) {
    const day = dateKey(date), month = day.slice(0, 7);
    activeDays.add(day);
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + amount);
  }
  const [bestMonthKey, bestMonth] = [...monthlyTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const streak = (() => {
    let count=0; const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if (!activeDays.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    while (activeDays.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate()-1); }
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
  const level = [...levels].reverse().find(item => lifetimeAmount >= item.min) || levels[0];
  const levelProgress = Math.min(100, Math.max(0, (lifetimeAmount - level.min) / (level.next - level.min) * 100));

  const levelNumber = levels.indexOf(level) + 1;
  const nextLevel = levels[levelNumber];
  const remaining = Math.max(0, level.next - lifetimeAmount);
  const experienceAmount = (amount: number) => amount.toLocaleString("cs-CZ", { maximumFractionDigits: strength ? 0 : 2 }) + " " + unit;
  const awards = activityAwards(selected, goalType);

  return <>
    <Navbar title="Můj pokrok" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)}/>
    <main className="container progress-page">
      <ActivityTypeSelector value={goalType} onChange={setGoalType} ariaLabel="Typ aktivity pro pokrok" />


      <ProgressChart key={goalType} runs={selected} activityType={goalType} loading={personalState.loading} error={!!personalState.error} />

      {(!personalState.loading || personalState.data.length > 0) && (!personalState.error || personalState.data.length > 0) && <>
      <AwardSection title="Odznaky" awards={awards.filter(award => award.repeatable)} />
      <AwardSection title="Úspěchy" awards={awards.filter(award => !award.repeatable)} />

      <ActivityCalendar key={goalType} runs={selected} activityType={goalType} />

      <section className="tile progress-records">
        <div className="progress-section-title"><Trophy/><div><h2>Osobní rekordy</h2><p>Nejlepší výkony v kategorii {goalType}.</p></div></div>
        <div className="app-metric-grid">
          <Metric icon={strength ? <ActivityTypeIcon type={goalType}/> : <MapPin/>} tone={strength ? "repetitions" : "distance"}
            label={strength ? "Nejvíce v jedné aktivitě" : "Nejdelší aktivita"}
            value={longest ? formatMetricNumber(longest.amount) : "—"} unit={longest ? unit : undefined}
            detail={longest ? longest.date.toLocaleDateString("cs-CZ") : "Zatím bez aktivity"}/>
          {!strength && <Metric icon={<Gauge/>} tone="pace" label="Nejrychlejší tempo"
            value={fastest ? formatCompactActivityTime(asNumber(fastest.run.tempo)) : "—"} unit={fastest ? "/km" : undefined}
            detail={fastest ? fastest.date.toLocaleDateString("cs-CZ") : "Zatím bez aktivity"}/>}
          <Metric icon={<CalendarDays/>} tone="count" label="Nejvíce za měsíc" value={formatMetricNumber(bestMonth)} unit={unit}
            detail={bestMonthKey ? new Date(bestMonthKey + "-01T12:00:00").toLocaleDateString("cs-CZ", { month: "long", year: "numeric" }) : "Zatím bez aktivity"}/>
          <Metric icon={<Flame/>} tone="award" label="Aktuální série" value={streak} unit={streak === 1 ? "den" : streak >= 2 && streak <= 4 ? "dny" : "dní"}
            detail="Aktivní dny za sebou"/>
        </div>
      </section>

      <details className="progress-level tile progress-experience">
        <summary>Úrovně aktivity</summary>
        <p className="chart-hint">Úroveň vychází z {strength ? "celkového počtu opakování" : "celkové vzdálenosti"} v této kategorii za celou dobu.</p>
        <div className="progress-experience-main">
          <span className="progress-level-emoji" aria-hidden="true">{level.icon}</span>
          <div><small>Úroveň {levelNumber} / {levels.length}</small><h3>{level.name}</h3></div>
          <strong>{experienceAmount(lifetimeAmount)}<small>Celkem</small></strong>
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
      </details>

      </>}
      {personalState.loading && <LoadingSkeleton count={2} />}
    </main>
  </>;
}
