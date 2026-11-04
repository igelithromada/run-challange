"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { signOut } from "firebase/auth";
import useAdminGuard from "../../../lib/useAdminGuard";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";
import ActivityCard from "../../../components/ActivityCard";
import { Footprints } from "lucide-react";

type Run = {
  id:string; uid?:string; km?:number|string; minuty?:number|string; tempo?:number|string; type?:string;
  timestamp?:any; imageUrls?:string[]; imageUrl?:string; nickname?:string; email?:string; teamId?:string;
};

export default function RecordsPage() {
  const adminAccess = useAdminGuard();
  const { id } = useParams() as { id:string };
  const router = useRouter();
  const [menuVisible,setMenuVisible] = useState(false);
  const [runs,setRuns] = useState<Run[]>([]);
  const [selectedType,setSelectedType] = useState<"běh"|"chůze">("běh");
  const [lightbox,setLightbox] = useState<{urls:string[];index:number}|null>(null);

  useEffect(() => {
    if (adminAccess !== "allowed" || !id) return;
    const unsub = onSnapshot(query(collection(db,"runs"),where("uid","==",id)), snap => {
      const items = snap.docs.map(d => ({id:d.id,...d.data()} as Run));
      items.sort((a,b) => (b.timestamp?.seconds||0)-(a.timestamp?.seconds||0));
      setRuns(items);
    });
    return () => unsub();
  }, [adminAccess,id]);

  const handleDelete = async (runId:string) => {
    if (!window.confirm("Opravdu smazat tento záznam?")) return;
    try { await deleteDoc(doc(db,"runs",runId)); }
    catch(error) { console.error(error); window.alert("Smazání se nepodařilo."); }
  };

  const handleSelect = async (item:string) => {
    setMenuVisible(false);
    if (item==="logout") { await signOut(auth); router.push("/login"); return; }
    if (item==="myrun") { router.push("/myruns"); return; }
    if (item==="home") { router.push("/"); return; }
    router.push("/"+item);
  };

  if (adminAccess !== "allowed") return <div className="container"><div className="tile">Ověřuji administrátorská oprávnění…</div></div>;

  return <>
    <Navbar title="Záznamy uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} />
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect} />
    <main className="container admin-records-page">
      <div className="admin-page-intro">
        <span className="admin-eyebrow">ADMINISTRACE</span>
        <h1>Záznamy uživatele</h1>
        <p>Aktivity, fotografie a možnost moderace.</p>
      </div>

      <div className="tile-group">
        <button className={`tile-button ${selectedType==="běh"?"active":""}`} onClick={()=>setSelectedType("běh")}><img className="run-profile-icon" src="/run-icon-white.png" alt="" /> Běh</button>
        <button className={`tile-button ${selectedType==="chůze"?"active":""}`} onClick={()=>setSelectedType("chůze")}><Footprints size={24}/> Chůze</button>
      </div>

      <div className="list-container">
        {runs.filter(r => (r.type||"běh")===selectedType).map(run => {
          const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];
          return <ActivityCard key={run.id}
            run={{...run, km:run.km??0,minuty:run.minuty??0,tempo:run.tempo??0}}
            nickname={run.nickname || run.email?.split("@")[0] || "Uživatel"}
            activityType={selectedType}
            teamName={null}
            onPhotosClick={(urls)=>setLightbox({urls,index:0})}
            onDelete={()=>void handleDelete(run.id)}
          />;
        })}
        {runs.filter(r => (r.type||"běh")===selectedType).length===0 && <div className="tile empty-state"><strong>Žádné záznamy</strong><span>Uživatel zatím nemá žádnou aktivitu tohoto typu.</span></div>}
      </div>
    </main>

    {lightbox && <div className="admin-lightbox" role="dialog" aria-modal="true" onClick={()=>setLightbox(null)}>
      <button className="admin-lightbox-close" onClick={()=>setLightbox(null)} aria-label="Zavřít">×</button>
      <img src={lightbox.urls[lightbox.index]} alt="Fotografie aktivity" onClick={e=>e.stopPropagation()} />
      {lightbox.urls.length>1 && <>
        <button className="admin-lightbox-prev" onClick={e=>{e.stopPropagation();setLightbox(s=>s&&({...s,index:(s.index-1+s.urls.length)%s.urls.length}))}} aria-label="Předchozí">‹</button>
        <button className="admin-lightbox-next" onClick={e=>{e.stopPropagation();setLightbox(s=>s&&({...s,index:(s.index+1)%s.urls.length}))}} aria-label="Další">›</button>
        <span className="admin-lightbox-count">{lightbox.index+1} / {lightbox.urls.length}</span>
      </>}
    </div>}
  </>;
}
