"use client";
import PhotoViewer from "../../../components/PhotoViewer";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "../../../lib/firebase";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";
import useAdminGuard from "../../../lib/useAdminGuard";
import { Camera } from "lucide-react";
import { fetchRuns, userRunsQuery } from "../../../lib/services/runs";
import { showAppToast } from "../../../components/AppToast";

type GalleryPhoto = { id:string; photoUrl:string; date:string; sortTime:number; runId:string; photoIndex:number };

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

  useEffect(() => { if (error) showAppToast(error, "error"); }, [error]);

  useEffect(() => {
    if (adminAccess !== "allowed" || !id) return;
    let active=true;
    const load=async()=>{
      setLoading(true); setError("");
      try {
        const runs = await fetchRuns(userRunsQuery(id));
        const result:GalleryPhoto[]=[];
        runs.forEach(d=>{
          const data=d;
          const urls:string[] = Array.isArray(data.imageUrls) ? data.imageUrls.filter((u:unknown):u is string=>typeof u==="string"&&u.length>0) : [];
          if (!urls.length && typeof data.imageUrl==="string" && data.imageUrl) urls.push(data.imageUrl);
          const ts = data.timestamp; const dateValue = ts instanceof Date ? ts : ts && "toDate" in ts && typeof ts.toDate === "function" ? ts.toDate() : ts && "seconds" in ts && typeof ts.seconds === "number" ? new Date(ts.seconds*1000) : null; const date = dateValue ? dateValue.toLocaleString("cs-CZ",{day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "Neznámé datum";
          urls.forEach((photoUrl,index)=>result.push({id:`${d.id}-${index}`,photoUrl,date,sortTime:dateValue?.getTime() || 0,runId:d.id,photoIndex:index}));
        });
        result.sort((a,b)=>b.sortTime-a.sortTime);
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

  if(adminAccess!=="allowed") return <><Navbar title="Galerie uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} /><Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)}/><main className="container"><div className="tile">Ověřuji administrátorská oprávnění…</div></main></>;

  return <>
    <Navbar title="Galerie uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} />
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)}/>
    <main className="container admin-gallery-page">
      <div className="admin-page-intro"><span className="admin-eyebrow">ADMINISTRACE</span><h1>Galerie uživatele</h1><p>{photos.length} fotografií · kliknutím otevřeš náhled.</p></div>
      {loading && <div className="tile">Načítám galerii…</div>}

      {!loading && !error && photos.length===0 && <div className="tile empty-state"><Camera size={28}/><strong>Žádné fotografie</strong><span>Uživatel zatím nemá fotografie u svých aktivit.</span></div>}
      <div className="admin-gallery-grid">
        {photos.map((photo,index)=><button type="button" className="admin-gallery-item" key={photo.id} onClick={()=>setLightbox(index)}>
          <img src={photo.photoUrl} alt="Fotografie aktivity" loading="lazy"/>
          <span>{photo.date}</span>
        </button>)}
      </div>
    </main>
    {lightbox!==null && photos[lightbox] && <PhotoViewer url={photos[lightbox].photoUrl} onClose={()=>setLightbox(null)} onMove={direction=>setLightbox(index=>index===null?null:(index+direction+photos.length)%photos.length)} onDelete={()=>void deleteCurrentPhoto()} deleting={deleting} footer={<span>{photos[lightbox].date}</span>}/>}
  </>;
}
