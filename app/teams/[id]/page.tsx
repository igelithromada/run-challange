"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Save, Users } from "lucide-react";
import { db, auth } from "../../lib/firebase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { ActivityType, ActivityTypeIcon } from "../../components/ActivityTypeSelector";
import { cloudinaryImageUrl } from "../../lib/imageUrl";

type Member = { id:string; nickname:string; email:string; avatarUrl:string };

export default function TeamDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [menuVisible,setMenuVisible]=useState(false);
  const [team,setTeam]=useState<any>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [user,setUser]=useState<any>(null);
  const [goal,setGoal]=useState("500");
  const [avatarUrl,setAvatarUrl]=useState("");
  const [avatarPublicId,setAvatarPublicId]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [isMember,setIsMember]=useState(false);

  const load = async (uid?:string) => {
    if(!id) return;
    try {
      const snap=await getDoc(doc(db,"teams",id));
      if(!snap.exists()){ router.replace("/teams"); return; }
      const data=snap.data();
      setTeam({id:snap.id,...data});
      if(uid){ const profile=await getDoc(doc(db,"users",uid)); const p=profile.exists()?profile.data():{}; setIsMember(p.teamIdsByType?.[data.type==="chůze"?"chůze":"běh"]===id || (data.type!=="chůze" && p.teamId===id)); }
      setGoal(String(Number(data.challengeGoalKm)||500));
      setAvatarUrl(data.avatarUrl||"");
      setAvatarPublicId(data.avatarPublicId||"");
      const type:ActivityType=data.type==="chůze"?"chůze":"běh";
      const [memberSnap, legacySnap]=await Promise.all([
        getDocs(query(collection(db,"users"),where(`teamIdsByType.${type}`,"==",id))),
        type==="běh" ? getDocs(query(collection(db,"users"),where("teamId","==",id))) : Promise.resolve(null)
      ]);
      const memberDocs=[...memberSnap.docs,...(legacySnap?.docs||[])];
      const unique=new Map(memberDocs.map(d=>[d.id,d]));
      setMembers(Array.from(unique.values()).map(d=>({id:d.id,nickname:d.data().nickname||"Uživatel",email:d.data().email||"",avatarUrl:d.data().avatarUrl||""})).sort((a,b)=>a.nickname.localeCompare(b.nickname,"cs")));
    } finally { setLoading(false); }
  };

  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(!u){router.push("/login");return;}
    setUser(u); await load(u.uid);
  }),[id,router]);

  const isOwner=team?.createdBy===user?.uid;
  const teamType:ActivityType=team?.type==="chůze"?"chůze":"běh";

  const leave=async()=>{
    if(!user||!isMember)return;
    const next={...(team?.type==="chůze"?{}:{}), běh:null, chůze:null};
    const profile=await getDoc(doc(db,"users",user.uid)); const data=profile.exists()?profile.data():{}; const stored=data.teamIdsByType||{};
    const activity:ActivityType=team?.type==="chůze"?"chůze":"běh"; next[activity]=null;
    await setDoc(doc(db,"users",user.uid),{teamIdsByType:{...stored,...next},...(activity==="běh"?{teamId:null,joinedTeam:null}:{})},{merge:true});
    setIsMember(false); setMessage("Z týmu jsi odešel.");
  };

  const save=async()=>{
    if(!isOwner) return;
    const value=Number(goal.replace(",","."));
    if(!Number.isFinite(value)||value<=0){setMessage("Zadej platný cíl.");return;}
    setSaving(true); setMessage("");
    try{
      await setDoc(doc(db,"teams",id),{challengeGoalKm:value,avatarUrl,avatarPublicId},{merge:true});
      setMessage("Nastavení týmu bylo uloženo.");
    }catch(e){console.error(e);setMessage("Nastavení se nepodařilo uložit.");}
    finally{setSaving(false);}
  };

  const uploadAvatar=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file||!isOwner)return;
    if(!file.type.startsWith("image/")||file.size>5*1024*1024){setMessage("Vyber obrázek do 5 MB.");e.target.value="";return;}
    try{
      const form=new FormData(); form.append("file",file); form.append("upload_preset","lhota_unsigned");
      const response=await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload",{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok||!result.secure_url) throw new Error("Nahrání selhalo.");
      setAvatarUrl(result.secure_url); setAvatarPublicId(result.public_id||""); setMessage("Avatar je připravený. Ulož nastavení týmu.");
    }catch(e){console.error(e);setMessage("Avatar se nepodařilo nahrát.");}
    finally{e.target.value="";}
  };

  const handleSelect=async(item:string)=>{
    setMenuVisible(false);
    if(item==="logout"){await signOut(auth);router.push("/login");return;}
    const routes:Record<string,string>={home:"/",myrun:"/myruns",teams:"/teams",progress:"/progress",trainer:"/trainer",statistics:"/statistics",participants:"/participants",weather:"/weather",settings:"/settings",admin:"/admin"};
    router.push(routes[item]||"/");
  };

  if(loading) return <><Navbar title="Tým" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile"><p>Načítám tým…</p></div></main></>;

  return <>
    <Navbar title={team?.name||"Tým"} onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/>
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
    <main className="container team-detail-page">
      <button className="ui-icon-button team-back-button" type="button" onClick={()=>router.push("/teams")} aria-label="Zpět na týmy"><ArrowLeft size={19}/></button>
      <header className="team-detail-header">
        <div className="team-detail-avatar">{avatarUrl?<img src={cloudinaryImageUrl(avatarUrl,160)} alt="Avatar týmu"/>:<Users size={30}/>}</div>
        <div><span className="progress-eyebrow">TÝM PRO {teamType==="běh"?"BĚH":"CHŮZI"}</span><h1>{team?.name}</h1><p>{members.length} {members.length===1?"účastník":"účastníků"} · cíl {Number(team?.challengeGoalKm)||500} km</p></div>
      </header>

      {isOwner && <section className="tile team-settings-card">
        <div className="progress-section-title"><Save/><div><h2>Nastavení týmu</h2><p>Uprav cíl měsíční výzvy a avatar, který se zobrazí u týmu.</p></div></div>
        <label className="team-detail-field">Cíl měsíční týmové výzvy (km)<input type="number" min="0.1" step="1" value={goal} onChange={e=>setGoal(e.target.value)}/></label>
        <label className="team-avatar-upload"><Camera size={18}/><span>{avatarUrl?"Změnit avatar týmu":"Přidat avatar týmu"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/></label>
        <button className="run-primary-button team-save-button" onClick={()=>void save()} disabled={saving}><Save size={18}/>{saving?"Ukládám…":"Uložit nastavení"}</button>
        {message&&<p className="teams-message">{message}</p>}
      </section>}

      {!isOwner && message&&<p className="teams-message">{message}</p>}
      {isMember && <button type="button" className="trainer-secondary-button team-leave-button" onClick={()=>void leave()}>Odejít z týmu</button>}

      <section className="tile team-members-card">
        <div className="progress-section-title"><Users/><div><h2>Účastníci týmu</h2><p>Seznam lidí, kteří mají tento tým nastavený pro {teamType}.</p></div></div>
        <div className="team-members-list">
          {members.map(member=><button key={member.id} type="button" className="team-member-row" onClick={()=>router.push("/user/"+member.id)}>
            <span className="team-member-avatar">{member.avatarUrl?<img src={cloudinaryImageUrl(member.avatarUrl,96)} alt=""/>:member.nickname.charAt(0).toUpperCase()}</span>
            <span><strong>{member.nickname}</strong><small>{member.email}</small></span>
            {member.id===team?.createdBy&&<Check size={17}/>}
          </button>)}
          {!members.length&&<p className="team-empty">Tým zatím nemá načtené účastníky.</p>}
        </div>
      </section>
    </main>
  </>;
}
