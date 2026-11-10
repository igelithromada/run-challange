"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, query, addDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, ChevronRight } from "lucide-react";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType, ActivityTypeIcon } from "../components/ActivityTypeSelector";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { cloudinaryImageUrl } from "../lib/imageUrl";

export default function TeamsPage() {
  const [menuVisible,setMenuVisible]=useState(false);
  const [teamName,setTeamName]=useState("");
  const [selectedType,setSelectedType]=useState<ActivityType>("běh");
  const [teamIdsByType,setTeamIdsByType]=useState<Record<ActivityType,string|null>>({běh:null,chůze:null});
  const [user,setUser]=useState<any>(null);
  const [teamMessage,setTeamMessage]=useState("");
  const router=useRouter();

  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(!u){router.push("/login");return;}
    setUser(u);
    const snap=await getDoc(doc(db,"users",u.uid));
    if(snap.exists()){
      const data=snap.data(), stored=data.teamIdsByType||{};
      setTeamIdsByType({
        běh:typeof stored.běh==="string"?stored.běh:(typeof data.teamId==="string"?data.teamId:null),
        chůze:typeof stored.chůze==="string"?stored.chůze:null
      });
    }
  }),[router]);

  const teamsQuery=useMemo(()=>query(collection(db,"teams")),[]);
  const teamsState=useSharedFirestoreQuery<any>("teams:all",teamsQuery);
  const teams=teamsState.data;
  const visibleTeams=teams.filter(team=>(team.type==="chůze"?"chůze":"běh")===selectedType);
  const joinedTeamId=teamIdsByType[selectedType];
  const joinedTeam=teams.find(t=>t.id===joinedTeamId);

  const createTeam=async()=>{
    if(!teamName.trim()||!user)return;
    setTeamMessage("");
    try{
      const created=await addDoc(collection(db,"teams"),{name:teamName.trim(),type:selectedType,createdBy:user.uid,challengeGoalKm:500,avatarUrl:"",avatarPublicId:""});
      const next={...teamIdsByType,[selectedType]:created.id};
      await setDoc(doc(db,"users",user.uid),{teamIdsByType:next,...(selectedType==="běh"?{teamId:created.id,joinedTeam:created.id}:{})},{merge:true});
      setTeamIdsByType(next); setTeamName(""); setTeamMessage("Tým byl vytvořen a stal ses jeho členem.");
      router.push("/teams/"+created.id);
    }catch(e){console.error(e);setTeamMessage("Tým se nepodařilo vytvořit.");}
  };

  const joinTeam=async(team:any)=>{
    const type:ActivityType=team.type==="chůze"?"chůze":"běh";
    const next={...teamIdsByType,[type]:team.id};
    await setDoc(doc(db,"users",user.uid),{teamIdsByType:next,...(type==="běh"?{teamId:team.id,joinedTeam:team.id}:{})},{merge:true});
    setTeamIdsByType(next);
  };

  const leaveTeam=async()=>{
    if(!joinedTeamId||!user)return;
    const next={...teamIdsByType,[selectedType]:null};
    await setDoc(doc(db,"users",user.uid),{teamIdsByType:next,...(selectedType==="běh"?{teamId:null,joinedTeam:null}:{})},{merge:true});
    setTeamIdsByType(next);
  };

  const deleteTeam=async(team:any)=>{
    if(team.createdBy!==user?.uid||!window.confirm("Opravdu chceš tento tým smazat?"))return;
    await deleteDoc(doc(db,"teams",team.id));
    if(joinedTeamId===team.id) await leaveTeam();
  };

  const handleSelect=async(item:string)=>{
    setMenuVisible(false);
    if(item==="logout"){await signOut(auth);router.push("/login");return;}
    const routes:Record<string,string>={home:"/",myrun:"/myruns",teams:"/teams",settings:"/settings",statistics:"/statistics",participants:"/participants",progress:"/progress",trainer:"/trainer",weather:"/weather",admin:"/admin"};
    router.push(routes[item]||"/");
  };

  return <>
    <Navbar title="Týmy" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
    <main className="container teams-page">
      <header className="teams-header"><span className="teams-eyebrow">SPOLEČNĚ ZA POHYBEM</span><h1>Týmy</h1><p>Vyber si tým podle aktivity. Každý tým má vlastní nastavení, cíl a seznam účastníků.</p></header>

      <section className="tile teams-create">
        <div className="control-caption">Aktivita týmů</div>
        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Aktivita týmů"/>
        <div className="teams-section-heading"><div><h2>Vytvořit nový tým</h2><p>Nový tým bude automaticky určený pro {selectedType}.</p></div></div>
        <div className="teams-create-form">
          <input type="text" placeholder="Zadej název týmu" value={teamName} onChange={e=>setTeamName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void createTeam();}}/>
          <button onClick={()=>void createTeam()} className="run-primary-button" disabled={!teamName.trim()}><Plus size={18}/> Vytvořit tým</button>
        </div>
        {teamMessage&&<p className="teams-message">{teamMessage}</p>}
      </section>

      <div className="teams-list-heading">
        <div><h2>{selectedType==="běh"?"Běžecké":"Chodecké"} týmy</h2><p>{visibleTeams.length} {visibleTeams.length===1?"tým":"týmů"}</p></div>
        {joinedTeam&&<button className="tile-button team-current-button" onClick={()=>router.push("/teams/"+joinedTeam.id)}><Users size={17}/> Můj tým</button>}
      </div>

      <section className="teams-grid">
        {visibleTeams.map(team=>{
          const isJoined=joinedTeamId===team.id;
          return <article key={team.id} className={`tile team-card ${isJoined?"team-card-joined":""}`} onClick={()=>router.push("/teams/"+team.id)}>
            <div className="team-card-top">
              <div className="team-avatar">{team.avatarUrl?<img src={cloudinaryImageUrl(team.avatarUrl,96)} alt=""/>:<Users size={22}/>}</div>
              <span className="team-type-badge"><ActivityTypeIcon type={selectedType} size={16}/> {selectedType==="běh"?"Běh":"Chůze"}</span>
              {isJoined&&<span className="team-member-label">Tvůj tým</span>}
            </div>
            <h3>{team.name}</h3>
            <div className="team-card-meta"><span>Cíl</span><strong>{Number(team.challengeGoalKm)||500} km / měsíc</strong></div>
            <div className="team-card-actions">
              <button className="tile-button team-action-button" onClick={e=>{e.stopPropagation(); if(isJoined) router.push("/teams/"+team.id); else void joinTeam(team);}}>{isJoined?"Otevřít tým":"Přidat se"} <ChevronRight size={17}/></button>
              {user?.uid===team.createdBy&&<button className="tile-button team-delete-button" onClick={e=>{e.stopPropagation();void deleteTeam(team);}} aria-label="Smazat tým"><Trash2 size={18}/></button>}
            </div>
          </article>
        })}
        {!visibleTeams.length&&<div className="tile teams-empty"><Users size={30}/><strong>Zatím tu není žádný tým</strong><p>Vytvoř první tým pro {selectedType}.</p></div>}
      </section>
    </main>
  </>;
}
