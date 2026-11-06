"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../../lib/firebase";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";
import useAdminGuard from "../../../lib/useAdminGuard";
import { Camera, X } from "lucide-react";

type GalleryPhoto = { id:string; photoUrl:string; date:string; runId:string; photoIndex:number };

export default function GalleryPage() {
  const { id } = useParams() as {id:string};
  const router = useRouter();
  const adminAccess = useAdminGuard();
  const [menuVisible,setMenuVisible] = useState(false);
  const [photos,setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [lightbox,setLightbox] = useState<number|null>(null);
  const [deleting,setDeleting] = useState(false);

  useEffect(() => {
    if (adminAccess !== "allowed" || !id) return;
    let active=true;
    const load=async()=>{
      setLoading(true); setError("");
      try {
        const snapshot=await getDocs(query(collection(db,"runs"),where("uid","==",id)));
        const result:GalleryPhoto[]=[];
        snapshot.forEach(d=>{
          const data=d.data();
          const urls:string[] = Array.isArray(data.imageUrls) ? data.imageUrls.filter((u:unknown):u is string=>typeof u==="string"&&u.length>0) : [];
          if (!urls.length && typeof data.imageUrl==="string" && data.imageUrl) urls.push(data.imageUrl);
          const date = data.timestamp?.seconds ? new Date(data.timestamp.seconds*1000).toLocaleString("cs-CZ",{day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Neznámé datum";
          urls.forEach((photoUrl,index)=>result.push({id:`${d.id}-${index}`,photoUrl,date,runId:d.id,photoIndex:index}));
        });
        result.sort((a,b)=>a.date<b.date?1:-1);
        if(active) setPhotos(result);
      } catch(e) { console.error(e); if(active) setError("Galerii se nepodařilo načíst."); }
      finally { if(active) setLoading(false); }
    };
    void load(); return ()=>{active=false;};
  },[adminAccess,id]);

  const deleteCurrentPhoto = async () => {
    if (lightbox === null || deleting) return;
    const photo = photos[lightbox];
    if (!photo || !window.confirm("Opravdu chceš tuto fotografii trvale smazat?")) return;
    setDeleting(true); setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Nejsi přihlášen.");
      const token = await user.getIdToken(true);
      const response = await fetch("/api/runs/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ runId: photo.runId, index: photo.photoIndex })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Fotografii se nepodařilo smazat.");
      const next = photos.filter((_, index) => index !== lightbox).map(item => item.runId === photo.runId && item.photoIndex > photo.photoIndex ? { ...item, photoIndex: item.photoIndex - 1 } : item);
      setPhotos(next);
      if (!next.length) setLightbox(null);
      else setLightbox(Math.min(lightbox, next.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotografii se nepodařilo smazat.");
    } finally { setDeleting(false); }
  };

  const handleSelect=async(item:string)=>{
    setMenuVisible(false);
    if(item==="logout"){await signOut(auth);router.push("/login");return;}
    if(item==="myrun"){router.push("/myruns");return;}
    if(item==="home"){router.push("/");return;}
    if(item==="trainer"){router.push("/trainer");return;}
    router.push("/"+item);
  };

  if(adminAccess!=="allowed") return <div className="container"><div className="tile">Ověřuji administrátorská oprávnění…</div></div>;

  return <>
    <Navbar title="Galerie uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} />
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={handleSelect}/>
    <main className="container admin-gallery-page">
      <div className="admin-page-intro"><span className="admin-eyebrow">ADMINISTRACE</span><h1>Galerie uživatele</h1><p>{photos.length} fotografií · kliknutím otevřeš náhled.</p></div>
      {loading && <div className="tile">Načítám galerii…</div>}
      {error && <div className="tile form-message-error">{error}</div>}
      {!loading && !error && photos.length===0 && <div className="tile empty-state"><Camera size={28}/><strong>Žádné fotografie</strong><span>Uživatel zatím nemá fotografie u svých aktivit.</span></div>}
      <div className="admin-gallery-grid">
        {photos.map((photo,index)=><button type="button" className="admin-gallery-item" key={photo.id} onClick={()=>setLightbox(index)}>
          <img src={photo.photoUrl} alt="Fotografie aktivity" loading="lazy"/>
          <span>{photo.date}</span>
        </button>)}
      </div>
    </main>
    {lightbox!==null && <div className="admin-lightbox" role="dialog" aria-modal="true" onClick={()=>setLightbox(null)}>
      <button className="admin-lightbox-close" onClick={()=>setLightbox(null)} aria-label="Zavřít"><X/></button>
      <img src={photos[lightbox].photoUrl} alt="Fotografie aktivity" onClick={e=>e.stopPropagation()}/>
      <div className="admin-lightbox-actions" onClick={e=>e.stopPropagation()}><button type="button" className="admin-lightbox-delete" onClick={() => void deleteCurrentPhoto()} disabled={deleting}>{deleting ? "Mažu…" : "Smazat"}</button></div>
      {photos.length>1 && <>
        <button className="admin-lightbox-prev" onClick={e=>{e.stopPropagation();setLightbox(i=>(i===null?null:(i-1+photos.length)%photos.length))}} aria-label="Předchozí">‹</button>
        <button className="admin-lightbox-next" onClick={e=>{e.stopPropagation();setLightbox(i=>(i===null?null:(i+1)%photos.length))}} aria-label="Další">›</button>
        <span className="admin-lightbox-count">{lightbox+1} / {photos.length}</span>
      </>}
    </div>}
  </>;
}
