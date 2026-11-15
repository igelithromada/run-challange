"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Footprints, Target, Trophy, Users } from "lucide-react";
import { auth } from "../../lib/firebase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { showAppToast } from "../../components/AppToast";

type Challenge = {
  id: string; title: string; description?: string; type: "distance"|"activeDays"|"activities"|"target";
  scope: "individual"|"team"; activityType: "běh"|"chůze"; startAt: string; endAt: string;
  status: "upcoming"|"active"|"finished"; targetValue?: number; participantIds?: string[]; teamIds?: string[];
  createdBy: string;
};
type Result = { uid?: string; teamId?: string; rank: number; score: number; km?: number; activeDays?: number; activities?: number; participants?: number; activeParticipants?: number; completed?: boolean };

const labels = {
  distance: ["Nejvíce kilometrů", "km"],
  activeDays: ["Nejvíce aktivních dní", "aktivních dní"],
  activities: ["Nejvíce aktivit", "aktivit"],
  target: ["Dosažení cíle", "km"],
} as const;

export default function ChallengeDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [menuVisible,setMenuVisible]=useState(false);
  const [challenge,setChallenge]=useState<Challenge|null>(null);
  const [results,setResults]=useState<Result[]>([]);
  const [loading,setLoading]=useState(true);
  const [uid,setUid]=useState("");

  const load=async()=>{
    const user=auth.currentUser;
    if(!user || !id) return;
    const token=await user.getIdToken();
    const response=await fetch("/api/challenges?id="+encodeURIComponent(id),{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"Výzvu se nepodařilo načíst.");
    setUid(user.uid); setChallenge(data.challenge); setResults(data.results||[]);
  };

  useEffect(()=>{let active=true;(async()=>{try{await load()}catch(e){if(active)showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo načíst.","error")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[id]);

  const join=async()=>{
    if(!challenge)return;
    try{
      const token=await auth.currentUser?.getIdToken();
      let teamId=challenge.teamIds?.[0];
      if(challenge.scope==="team"){
        const response=await fetch("/api/teams/list",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
        const data=await response.json();
        const mine=(data.teams||[]).find((team:any)=>team.memberIds?.includes(uid)&& (team.type==="chůze"?"chůze":"běh")===challenge.activityType && challenge.teamIds?.includes(team.id));
        teamId=mine?.id||teamId;
      }
      const response=await fetch("/api/challenges",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"join",challengeId:id,teamId})});
      const data=await response.json(); if(!response.ok)throw new Error(data.error||"Přihlášení se nepodařilo.");
      showAppToast("Do výzvy ses přihlásil."); await load();
    }catch(e){showAppToast(e instanceof Error?e.message:"Přihlášení se nepodařilo.","error")}
  };

  if(loading)return <><Navbar title="Výzva" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile">Načítám výzvu…</div></main></>;
  if(!challenge)return <><Navbar title="Výzva" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile">Výzva nebyla nalezena.</div></main></>;

  const joined=challenge.scope==="individual"?challenge.participantIds?.includes(uid):challenge.teamIds?.length;
  const [typeTitle,unit]=labels[challenge.type];
  const icon=challenge.scope==="team"?<Users/>:challenge.type==="target"?<Target/>:<Footprints/>;

  return <>
    <Navbar title="Výzva" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={item=>{setMenuVisible(false);router.push(item==="home"?"/":"/"+item)}}/>
    <main className="container challenge-detail-page">
      <button className="run-secondary-button" onClick={()=>router.push("/challenges")}><ArrowLeft size={17}/> Zpět na výzvy</button>
      <section className="tile challenge-hero-card">
        <div className="challenge-hero-icon">{icon}</div>
        <div><span className="challenge-status">{challenge.status==="active"?"PROBÍHÁ":challenge.status==="finished"?"DOKONČENO":"PŘIPRAVUJE SE"}</span><h1>{challenge.title}</h1><strong>{typeTitle}</strong><p>{challenge.description||"Bez doplňujícího popisu."}</p></div>
      </section>

      <section className="challenge-info-grid">
        <div className="tile"><CalendarDays size={19}/><strong>Období</strong><span>{new Date(challenge.startAt).toLocaleString("cs-CZ")} – {new Date(challenge.endAt).toLocaleString("cs-CZ")}</span></div>
        <div className="tile"><Footprints size={19}/><strong>Aktivita</strong><span>{challenge.activityType}</span></div>
        <div className="tile"><Users size={19}/><strong>Účast</strong><span>{challenge.scope==="team"?"Týmová":"Individuální"} · dobrovolná</span></div>
        {challenge.type==="target"&&<div className="tile"><Target size={19}/><strong>Cíl</strong><span>{challenge.targetValue} km</span></div>}
      </section>

      {challenge.status==="upcoming"&&!joined&&<button className="run-primary-button challenge-detail-join" onClick={()=>void join()}><CheckCircle2 size={18}/> Přihlásit se do výzvy</button>}

      <section className="tile challenge-rules-card">
        <div className="progress-section-title"><Target/><div><h2>Pravidla</h2><p>Výsledky se počítají pouze z aktivit odpovídajících typu výzvy v jejím pevném období.</p></div></div>
        <ul><li>Účast je dobrovolná a po začátku výzvy se už nemění.</li><li>Výškové metry se do výzev nezapočítávají.</li><li>U týmové výzvy se účastníci zamknou při startu.</li><li>Týmové skóre je normalizované podle aktivních účastníků, aby nebyla zvýhodněná jen velikost týmu.</li><li>Po skončení jsou výsledky historické a zamčené.</li></ul>
      </section>

      <section className="challenge-results-section">
        <div className="progress-section-title"><Trophy/><div><h2>Výsledky</h2><p>{challenge.scope==="team"?"Pořadí týmů":"Pořadí účastníků"} · {typeTitle}</p></div></div>
        <div className="challenge-results-list">
          {results.length===0?<div className="tile challenge-empty">Výsledky se objeví po zahájení výzvy.</div>:results.map(result=><article className={result.rank===1?"tile challenge-result winner":"tile challenge-result"} key={result.teamId||result.uid}><span className="challenge-rank">{result.rank}</span><div className="challenge-result-main"><strong>{challenge.scope==="team"?`Tým ${result.teamId}`:`Účastník ${result.uid===uid?"Ty":"účastník"}`}</strong><small>{result.activeParticipants!==undefined?`${result.activeParticipants} aktivních z ${result.participants} účastníků`:""}</small></div><div className="challenge-score"><strong>{result.score}</strong><span>{unit}{challenge.type==="target"&&result.completed?" ✓":""}</span></div></article>)}
        </div>
      </section>
    </main>
  </>;
}
