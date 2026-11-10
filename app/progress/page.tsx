"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Award, CalendarDays, Footprints, Medal, Target, Trophy, Users, TrendingUp, Save, CheckCircle2, Lock, Zap, Flame } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import type { RunData, TeamData, LegacyTrainerPlan } from "../types";
import { getUserProfile, mergeUserProfile } from "../lib/services/users";
import { allTeamsQuery } from "../lib/services/teams";
import { userRunsQuery, teamRunsQuery } from "../lib/services/runs";

type ProgressActivity = Pick<RunData, "id" | "uid" | "km" | "minuty" | "tempo" | "teamId" | "timestamp" | "type">;
const asNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const activityDate = (run: ProgressActivity) => {
  const value = run.timestamp;
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if ("toDate" in value && typeof value.toDate === "function") return value.toDate();
  if ("seconds" in value && typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return new Date(0);
};
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
  const [joinedTeamId, setJoinedTeamId] = useState("");
  const [teamIdsByType, setTeamIdsByType] = useState<Record<ActivityType, string | null>>({ běh: null, chůze: null });
  const [goalWeekly, setGoalWeekly] = useState("25");
  const [goalMonthly, setGoalMonthly] = useState("100");
  const [goalType, setGoalType] = useState("běh");
  const [goalsByType, setGoalsByType] = useState<Record<ActivityType, { weekly: number; monthly: number }>>({ běh: { weekly: 25, monthly: 100 }, chůze: { weekly: 25, monthly: 100 } });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trainerDays, setTrainerDays] = useState<number[]>([1,3,5]);
  const [trainerKm, setTrainerKm] = useState("20");
  const [trainerSaved, setTrainerSaved] = useState(false);

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, async user => {
      if (!user) { router.push("/login"); return; }
      setUid(user.uid);
      try {
        const data = await getUserProfile(user.uid);
        if (data) {
          const trainer = data.personalTrainerPlan as LegacyTrainerPlan | undefined;
          if (trainer && Array.isArray(trainer.days)) setTrainerDays(trainer.days.filter((day: unknown) => typeof day === "number" && day >= 0 && day <= 6));
          if (trainer && Number(trainer.weeklyKm) > 0) setTrainerKm(String(trainer.weeklyKm));
          const storedGoals = data.progressGoalsByType || {};
          const legacy = data.progressGoals || {};
          const nextGoals = {
            běh: { weekly: asNumber(storedGoals.běh?.weekly ?? (legacy.type === "běh" ? 25 : 25)) || 25, monthly: asNumber(storedGoals.běh?.monthly ?? (legacy.type === "běh" ? 100 : 100)) || 100 },
            chůze: { weekly: asNumber(storedGoals.chůze?.weekly ?? (legacy.type === "chůze" ? 25 : 25)) || 25, monthly: asNumber(storedGoals.chůze?.monthly ?? (legacy.type === "chůze" ? 100 : 100)) || 100 }
          };
          setGoalsByType(nextGoals);
          const initialType = legacy.type === "chůze" ? "chůze" : "běh";
          setGoalType(initialType);
          setGoalWeekly(String(nextGoals[initialType].weekly));
          setGoalMonthly(String(nextGoals[initialType].monthly));
          const storedTeams = data.teamIdsByType || {};
          const nextTeamIds: Record<ActivityType, string | null> = {
            běh: typeof storedTeams.běh === "string" ? storedTeams.běh : (typeof data.teamId === "string" ? data.teamId : null),
            chůze: typeof storedTeams.chůze === "string" ? storedTeams.chůze : null,
          };
          setTeamIdsByType(nextTeamIds);
          setJoinedTeamId(nextTeamIds[initialType] || "");
        }
      } catch (error) { console.error("Nepodařilo se načíst profil a cíle", error); }
    });
    return () => stopAuth();
  }, [router]);

  const personalQuery = useMemo(() => userRunsQuery(uid || "__no_user__"), [uid]);
  const teamActivityQuery = useMemo(() => teamRunsQuery(joinedTeamId || "__no_team__"), [joinedTeamId]);
  const teamsQuery = useMemo(() => allTeamsQuery(), []);
  const personalState = useSharedFirestoreQuery<ProgressActivity>("progress:personal:" + (uid || "none"), personalQuery);
  const teamRunsState = useSharedFirestoreQuery<ProgressActivity>("progress:team:" + (joinedTeamId || "none"), teamActivityQuery);
  const teamsState = useSharedFirestoreQuery<TeamData>("teams:all", teamsQuery);
  const runs = useMemo(() => {
    const merged = new Map<string, ProgressActivity>();
    [...personalState.data, ...teamRunsState.data].forEach(run => merged.set(run.id, run));
    return Array.from(merged.values());
  }, [personalState.data, teamRunsState.data]);
  const teams = teamsState.data;
  useEffect(() => { setLoading(personalState.loading || (!!joinedTeamId && teamRunsState.loading)); }, [personalState.loading, teamRunsState.loading, joinedTeamId]);

  const mine = useMemo(() => personalState.data, [personalState.data]);
  const selected = useMemo(() => mine.filter(run => (run.type || "běh") === goalType), [mine, goalType]);
  const now = new Date();
  const weekStart = mondayOf(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekRuns = selected.filter(run => activityDate(run) >= weekStart && activityDate(run) <= now);
  const monthRuns = selected.filter(run => activityDate(run) >= monthStart && activityDate(run) <= now);
  const weekKm = weekRuns.reduce((sum, run) => sum + asNumber(run.km), 0);
  const monthKm = monthRuns.reduce((sum, run) => sum + asNumber(run.km), 0);
  const allKm = selected.reduce((sum, run) => sum + asNumber(run.km), 0);
  const allActivities = selected.length;
  const progressWeekly = Math.min(100, goalWeekly && asNumber(goalWeekly)>0 ? weekKm/asNumber(goalWeekly)*100 : 0);
  const progressMonthly = Math.min(100, goalMonthly && asNumber(goalMonthly)>0 ? monthKm/asNumber(goalMonthly)*100 : 0);

  const sorted = [...selected].sort((a,b) => activityDate(a).getTime()-activityDate(b).getTime());
  const longest = sorted.reduce<ProgressActivity | null>((best, run) => !best || asNumber(run.km)>asNumber(best.km) ? run : best, null);
  const fastest = sorted.filter(run => asNumber(run.tempo)>0).reduce<ProgressActivity | null>((best, run) => !best || asNumber(run.tempo)<asNumber(best.tempo) ? run : best, null);
  const dailyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) dailyTotals.set(dateKey(d),(dailyTotals.get(dateKey(d))||0)+asNumber(run.km)); });
  const maxDay = Math.max(0, ...Array.from(dailyTotals.values()));
  const monthlyTotals = new Map<string, number>();
  selected.forEach(run => { const d=activityDate(run); if (!Number.isNaN(d.getTime())) { const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; monthlyTotals.set(key,(monthlyTotals.get(key)||0)+asNumber(run.km)); } });
  const bestMonth = Math.max(0, ...Array.from(monthlyTotals.values()));
  const activityDays = new Set(mine.map(run => dateKey(activityDate(run)))).size;
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
  const calendarDays = useMemo(() => {
    const end = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const start = mondayOf(new Date(end.getTime()-83*86400000));
    const days: Date[]=[];
    for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) days.push(new Date(d));
    return days;
  }, [runs.length]);

  const teamProgress = teams.filter(team => team.id === joinedTeamId).map(team => {
    const km = runs.filter(run => (run.type || "běh")===goalType && run.teamId===team.id && activityDate(run).getFullYear()===now.getFullYear() && activityDate(run).getMonth()===now.getMonth())
      .reduce((sum,run)=>sum+asNumber(run.km),0);
    const goalKm = asNumber(team.challengeGoalKm) || 500;
    return { ...team, km, goalKm, percent:Math.min(100,km/goalKm*100) };
  }).sort((a,b)=>b.km-a.km);

  const switchGoalType = (nextType: ActivityType) => {
    setGoalType(nextType);
    const values = goalsByType[nextType] || { weekly: 25, monthly: 100 };
    setGoalWeekly(String(values.weekly));
    setGoalMonthly(String(values.monthly));
  };
  const saveGoals = async () => {
    if (!uid || asNumber(goalWeekly)<=0 || asNumber(goalMonthly)<=0) return;
    const updatedGoals = { ...goalsByType, [goalType]: { weekly: asNumber(goalWeekly), monthly: asNumber(goalMonthly) } };
    setGoalsByType(updatedGoals);
    await mergeUserProfile(uid, { progressGoalsByType: updatedGoals, progressGoals:{ weekly:asNumber(goalWeekly), monthly:asNumber(goalMonthly), type:goalType } });
    setSaved(true); window.setTimeout(()=>setSaved(false),2500);
  };
  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item==="logout") { await signOut(auth); router.push("/login"); }
    else if (item==="home") router.push("/");
    else if (item==="myrun") router.push("/myruns");
    else if (item==="trainer") router.push("/trainer");
    else router.push("/"+item);
  };

  return <>
    <Navbar title="Můj progres" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
    <main className="container progress-page">
      <header className="progress-header">
        <span className="progress-eyebrow">TVŮJ POHYB. TVŮJ POSUN.</span>
        <h1>Můj progres</h1>
        <p>Každý kilometr se počítá. Sleduj cíle, úspěchy a svůj posun.</p>
      </header>

      <section className="progress-goal-settings tile">
        <div className="progress-section-title"><Target/><div><h2>Moje cíle</h2><p>Nastav si vlastní vzdálenost, které chceš dosáhnout.</p></div></div>
        <ActivityTypeSelector value={goalType as ActivityType} onChange={switchGoalType} ariaLabel="Typ cíle" />
        <div className="progress-goal-inputs">
          <label>Týdenní cíl (km)<input type="number" min="0.1" step="0.5" value={goalWeekly} onChange={e=>setGoalWeekly(e.target.value)}/></label>
          <label>Měsíční cíl (km)<input type="number" min="0.1" step="1" value={goalMonthly} onChange={e=>setGoalMonthly(e.target.value)}/></label>
          <button className="progress-save" onClick={saveGoals}><Save size={17}/>{saved?"Uloženo":"Uložit cíle"}</button>
        </div>
        <div className="progress-goal-bars">
          <div><div className="progress-bar-heading"><strong>Tento týden</strong><span>{weekKm.toFixed(1)} / {asNumber(goalWeekly)} km</span></div><div className="progress-track"><i style={{width:`${progressWeekly}%`}}/></div></div>
          <div><div className="progress-bar-heading"><strong>Tento měsíc</strong><span>{monthKm.toFixed(1)} / {asNumber(goalMonthly)} km</span></div><div className="progress-track"><i style={{width:`${progressMonthly}%`}}/></div></div>
        </div>
        <p className="trainer-goal-note">Osobní trenér používá stejné cíle jako tato stránka. Měsíční cíl je hlavní meta; trenér z něj vychází při plánování týdnů a zbytek můžeš doplnit vlastními aktivitami.</p>
      </section>

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
        <div className="progress-calendar-grid">{calendarDays.map(day=>{const km=dailyTotals.get(dateKey(day))||0;return <div key={dateKey(day)} className={`progress-day ${km===0?"":km<3?"level-1":km<7?"level-2":km<12?"level-3":"level-4"}`} title={`${day.toLocaleDateString("cs-CZ")}: ${km.toFixed(1)} km`}/>})}</div>
        <div className="progress-calendar-legend"><span>Méně</span><i/><i/><i/><i/><span>Více</span></div>
        <p className="progress-calendar-summary">{activityDays} aktivních dní · {maxDay.toFixed(1)} km nejvíce za jeden den</p>
      </section>

      <section className="tile progress-records">
        <div className="progress-section-title"><Trophy/><div><h2>Osobní rekordy</h2><p>Nejlepší výkony v kategorii {goalType}.</p></div></div>
        <div className="progress-record-grid">
          <div><span><Footprints size={20}/></span><small>Nejdelší aktivita</small><strong>{longest?asNumber(longest.km).toFixed(2)+" km":"—"}</strong></div>
          <div><span><Zap size={20}/></span><small>Nejrychlejší tempo</small><strong>{fastest?formatPace(asNumber(fastest.tempo)):"—"}</strong></div>
          <div><span><CalendarDays size={20}/></span><small>Nejvíce za měsíc</small><strong>{bestMonth.toFixed(1)} km</strong></div>
          <div><span><Flame size={20}/></span><small>Aktuální série</small><strong>{streak} {streak===1?"den":"dní"}</strong></div>
        </div>
      </section>

      <section className="tile progress-challenges">
        <div className="progress-section-title"><Users/><div><h2>Týmové výzvy</h2><p>Společný měsíční cíl nastavuje zakladatel týmu. Každý kilometr se počítá.</p></div></div>
        {teamProgress.length===0?<p className="progress-empty">Zatím nejsi členem týmu. Přidej se k některému v sekci Týmy a zapoj se do výzvy.</p>:<div className="progress-team-list">{teamProgress.map(team=><div className="progress-team" key={team.id}><div className="progress-team-heading"><strong>{team.name||"Tým"}</strong><span>{team.km.toFixed(1)} / {team.goalKm} km</span></div><div className="progress-track"><i style={{width:`${team.percent}%`}}/></div><small>{team.percent.toFixed(0)} % splněno</small></div>)}</div>}
        <button className="progress-link-button" onClick={()=>router.push("/teams")}><Users size={17}/> Zobrazit týmy</button>
      </section>
      {loading&&<LoadingSkeleton count={2} />}
    </main>
  </>;
}
