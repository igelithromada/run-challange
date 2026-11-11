"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Save, Users } from "lucide-react";
import { auth } from "../../lib/firebase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { ActivityType } from "../../components/ActivityTypeSelector";
import { cloudinaryImageUrl } from "../../lib/imageUrl";
import type { TeamData, PublicProfileData } from "../../types";
import { getPublicProfiles } from "../../lib/services/publicProfiles";
import { getTeam, mergeTeam } from "../../lib/services/teams";
import { showAppToast } from "../../components/AppToast";

type Member = PublicProfileData;

export default function TeamDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [menuVisible,setMenuVisible]=useState(false);
  const [team,setTeam]=useState<TeamData|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [user,setUser]=useState<import("firebase/auth").User|null>(null);
  const [goal,setGoal]=useState("500");
  const [avatarUrl,setAvatarUrl]=useState("");
  const [avatarPublicId,setAvatarPublicId]=useState("");
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [isMember,setIsMember]=useState(false);

  const load = async (uid: string, isActive: () => boolean) => {
    if (!id || !isActive()) return;
    try {
      const data = await getTeam(id);
      if (!isActive()) return;
      if(!data){ router.replace("/teams"); return; }
      setTeam(data);
      const memberIds = data.memberIds?.length ? data.memberIds : (data.createdBy ? [data.createdBy] : []);
      setIsMember(memberIds.includes(uid));
      setGoal(String(Number(data.challengeGoalKm) || 500));
      setAvatarUrl(data.avatarUrl || "");
      setAvatarPublicId(data.avatarPublicId || "");

      const profiles = await getPublicProfiles(memberIds);
      if (!isActive()) return;
      setMembers(Object.values(profiles).sort((a, b) =>
        (a.nickname || "Uživatel").localeCompare(b.nickname || "Uživatel", "cs")
      ));
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async u => {
      if (!active) return;
      if (!u) { router.push("/login"); return; }
      setUser(u);
      try {
        await load(u.uid, () => active);
      } catch (error) {
        if (active) {
          console.error("Nepodařilo se načíst tým", error);
          showAppToast("Tým se nepodařilo načíst.","error");
          setLoading(false);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, router]);

  const isOwner=team?.createdBy===user?.uid;
  const teamType:ActivityType=team?.type==="chůze"?"chůze":"běh";

  const leave=async()=>{
    if(!user||!isMember)return;
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/teams/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "leave", teamId: id }),
      });
      if (!response.ok) throw new Error("leave-failed");
      setIsMember(false);
      setTeam(previous => previous ? { ...previous, memberIds: (previous.memberIds || []).filter(memberId => memberId !== user.uid) } : previous);
      setMembers(previous => previous.filter(member => member.id !== user.uid));
      showAppToast("Z týmu jsi odešel.","success");
    } catch {
      showAppToast("Z týmu se nepodařilo odejít.","error");
    }
  };

  const save=async()=>{
    if(!isOwner) return;
    const value=Number(goal.replace(",","."));
    if(!Number.isFinite(value)||value<=0){showAppToast("Zadej platný cíl.","error");return;}
    setSaving(true);
    try{
      await mergeTeam(id,{challengeGoalKm:value,avatarUrl,avatarPublicId});
      showAppToast("Nastavení týmu bylo uloženo.","success");
    }catch(e){console.error(e);showAppToast("Nastavení se nepodařilo uložit.","error");}
    finally{setSaving(false);}
  };

  const uploadAvatar=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file||!isOwner)return;
    if(!file.type.startsWith("image/")||file.size>5*1024*1024){showAppToast("Vyber obrázek do 5 MB.","error");e.target.value="";return;}
    try{
      if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
      const token = await auth.currentUser.getIdToken();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/media/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.secureUrl !== "string") {
        throw new Error(result.error || "Nahrání selhalo.");
      }
      setAvatarUrl(result.secureUrl);
      setAvatarPublicId(typeof result.publicId === "string" ? result.publicId : "");
      showAppToast("Avatar je připravený. Ulož nastavení týmu.","success");
    }catch(e){console.error(e);showAppToast("Avatar se nepodařilo nahrát.","error");}
    finally{e.target.value="";}
  };

  const handleSelect=async(item:string)=>{
    setMenuVisible(false);
    if(item==="logout"){await signOut(auth);router.push("/login");return;}
    const routes:Record<string,string>={home:"/",myrun:"/myruns",teams:"/teams",progress:"/progress",trainer:"/trainer",statistics:"/statistics",participants:"/participants",weather:"/weather",settings:"/settings",admin:"/admin"};
    router.push(routes[item]||"/");
  };

  if(loading) return <><Navbar title="Tým" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")}/><main className="container"><div className="tile"><p>Načítám tým…</p></div></main></>;

  if (!team) {
    return (
      <>
        <Navbar title="Tým" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} />
        <main className="container">
          <div className="tile">
            <strong>Tým se nepodařilo načíst</strong>
            <p>Tým nebyl nalezen nebo k němu nemáš přístup.</p>
            <button type="button" className="run-primary-button" onClick={() => router.replace("/teams")}>Zpět na týmy</button>
          </div>
        </main>
      </>
    );
  }

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

      </section>}


      {isMember && <button type="button" className="trainer-secondary-button team-leave-button" onClick={()=>void leave()}>Odejít z týmu</button>}

      <section className="tile team-members-card">
        <div className="progress-section-title"><Users/><div><h2>Účastníci týmu</h2><p>Seznam lidí, kteří mají tento tým nastavený pro {teamType}.</p></div></div>
        <div className="team-members-list">
          {members.map(member=><button key={member.id} type="button" className="team-member-row" onClick={()=>router.push("/user/"+member.id)}>
            <span className="team-member-avatar">{member.avatarUrl?<img src={cloudinaryImageUrl(member.avatarUrl,96)} alt=""/>:(member.nickname || "U").charAt(0).toUpperCase()}</span>
            <span><strong>{member.nickname}</strong></span>
            {member.id===team?.createdBy&&<Check size={17}/>}
          </button>)}
          {!members.length&&<p className="team-empty">Tým zatím nemá načtené účastníky.</p>}
        </div>
      </section>
    </main>
  </>;
}
