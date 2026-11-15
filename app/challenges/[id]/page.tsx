"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Crown, LogOut, Target, Trophy, Users } from "lucide-react";
import { auth } from "../../lib/firebase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { getChallenge, getChallengeParticipants } from "../../lib/services/challenges";
import { cloudinaryImageUrl } from "../../lib/imageUrl";
import { showAppToast } from "../../components/AppToast";
import type { ChallengeData } from "../../types";

function date(value:string){return new Intl.DateTimeFormat("cs-CZ",{day:"numeric",month:"numeric",year:"numeric"}).format(new Date(value+"T12:00:00"));}
function kind(value:string){return value==="distance"?"Vzdálenost":value==="activities"?"Počet aktivit":value==="activeDays"?"Aktivní dny":"Společný cíl";}
function unit(value:string){return value==="distance"||value==="sharedDistance"?"km":value==="activities"?"aktivit":"dnů";}

export default function ChallengeDetailPage(){
 const params=useParams<{id:string}>(), router=useRouter();
 const id=String(params.id||"");
 const [menu,setMenu]=useState(false),[user,setUser]=useState<User|null>(null),[challenge,setChallenge]=useState<ChallengeData|null>(null),[participants,setParticipants]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[page,setPage]=useState(1);
 const load=async()=>{if(!id)return;setLoading(true);try{const [c,p]=await Promise.all([getChallenge(id),getChallengeParticipants(id)]);setChallenge(c);setParticipants(p); }catch(e){console.error(e);showAppToast("Výzvu se nepodařilo načíst.","error")}finally{setLoading(false)}};
 useEffect(()=>{const unsub=onAuthStateChanged(auth,u=>{if(!u){router.push("/login");return;}setUser(u);void load()});return()=>unsub()},[id,router]);
 const request=async(action:string)=>{if(!auth.currentUser)throw new Error("Nejsi přihlášen.");const token=await auth.currentUser.getIdToken(true);const res=await fetch("/api/challenges/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action,challengeId:id})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Operaci se nepodařilo dokončit.");};
 const active=participants.some(p=>p.id===user?.uid), isOwner=challenge?.createdBy===user?.uid;
 const joinLeave=async()=>{if(!challenge||busy)return;if(active&&!confirm("Opravdu chceš z výzvy odejít? Tvůj dosavadní výsledek bude odstraněn."))return;setBusy(true);try{await request(active?"leave":"join");showAppToast(active?"Odešel jsi z výzvy.":"Přidal ses k výzvě.","success");await load()}catch(e){showAppToast(e instanceof Error?e.message:"Operace se nepodařila.","error")}finally{setBusy(false)}};
 const remove=async()=>{if(!challenge||busy||!isOwner)return;if(!confirm("Opravdu chceš výzvu trvale smazat?"))return;setBusy(true);try{await request("delete");showAppToast("Výzva byla smazána.","success");router.push("/challenges")}catch(e){showAppToast(e instanceof Error?e.message:"Výzvu se nepodařilo smazat.","error")}finally{setBusy(false)}};
 if(loading)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)}/><main className="container"><LoadingSkeleton count={4}/></main></>;
 if(!challenge)return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)}/><main className="container"><div className="tile teams-empty">Výzva nebyla nalezena.</div></main></>;
 const sorted=[...participants].sort((a,b)=>Number(b.result||0)-Number(a.result||0)); const pages=Math.max(1,Math.ceil(sorted.length/10)); const rows=sorted.slice((page-1)*10,page*10);
 return <><Navbar title="Výzva" onMenuClick={()=>setMenu(true)} onHomeClick={()=>router.push("/")}/><Sidebar visible={menu} onClose={()=>setMenu(false)} onSelect={item=>{setMenu(false);const routes:any={home:"/",myrun:"/myruns",teams:"/teams",challenges:"/challenges",settings:"/settings",statistics:"/statistics",participants:"/participants",progress:"/progress",trainer:"/trainer",weather:"/weather",admin:"/admin"};router.push(routes[item]||"/")}}/>
 <main className="container challenge-detail-page"><button className="back-button" onClick={()=>router.push("/challenges")}><ArrowLeft size={18}/> Zpět na výzvy</button>
 <section className="tile challenge-detail-hero"><div className="team-avatar">{challenge.avatarUrl?<img src={cloudinaryImageUrl(challenge.avatarUrl,160)} alt=""/>:<Target size={28}/>}</div><div><span className="teams-eyebrow">{challenge.state==="active"?"AKTIVNÍ":challenge.state==="planned"?"PLÁNOVANÁ":"DOKONČENÁ"}</span><h1>{challenge.name}</h1>{challenge.description&&<p>{challenge.description}</p>}<p>{kind(challenge.kind)} · {challenge.activityType==="běh"?"Běh":"Chůze"} · {date(challenge.startDate)} – {date(challenge.endDate)}</p></div></section>
 <section className="tile challenge-action-row">{challenge.kind==="sharedDistance"?<strong>Společný cíl: {Number(challenge.sharedProgress||0).toFixed(1)} / {Number(challenge.goal).toFixed(1)} km</strong>:<strong>Cíl: {Number(challenge.goal)} {unit(challenge.kind)}</strong>}{challenge.state!=="completed"&&<button className="run-primary-button" onClick={()=>void joinLeave()} disabled={busy}>{active?<><LogOut size={17}/> Odejít z výzvy</>: "Přidat se k výzvě"}</button>}{isOwner&&challenge.state==="planned"&&<button className="run-danger-button" onClick={()=>void remove()} disabled={busy}>Smazat výzvu</button>}</section>
 <section className="tile"><h2>{challenge.kind==="sharedDistance"?"Účastníci":"Výsledky"}</h2>{challenge.state==="completed"&&challenge.kind!=="sharedDistance"&&<p className="challenge-result-note">{challenge.winnerId?"🏆 Výzvu vyhrál účastník s nejlepším výsledkem.":"Cíl nebyl splněn."}</p>}{challenge.kind==="sharedDistance"?<p>Na společném cíli aktuálně přispívá {participants.length} účastníků.</p>:<div className="challenge-leaderboard">{rows.map((p,i)=><div key={p.id} className={p.id===user?.uid?"challenge-row-current": "challenge-row"}><strong>{(page-1)*10+i+1}.</strong><span>{p.id===user?.uid?"Ty":"Uživatel"}</span><b>{Number(p.result||0).toFixed(challenge.kind==="distance"?1:0)} {unit(challenge.kind)}</b>{p.id===challenge.winnerId&&<Trophy size={17}/>}</div>)}</div>}{pages>1&&<div className="teams-pagination">{Array.from({length:pages},(_,i)=>i+1).map(n=><button key={n} className={n===page?"active":""} onClick={()=>setPage(n)}>{n}</button>)}</div>}</section>
 </main></>;
}