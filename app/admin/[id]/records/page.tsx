"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "../../../lib/firebase";
import useAdminGuard from "../../../lib/useAdminGuard";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";
import ActivityCard from "../../../components/ActivityCard";
import ActivityTypeSelector from "../../../components/ActivityTypeSelector";
import { showAppToast } from "../../../components/AppToast";
import type { RunData } from "../../../types";
import { userRunsQuery } from "../../../lib/services/runs";
import { useSharedFirestoreQuery } from "../../../lib/useSharedFirestoreQuery";

type Run = RunData;

export default function RecordsPage() {
  const adminAccess = useAdminGuard();
  const { id } = useParams() as { id:string };
  const router = useRouter();
  const [menuVisible,setMenuVisible] = useState(false);
  const [selectedType,setSelectedType] = useState<import("../../../types").ActivityType>("běh");
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (cached === "běh" || cached === "chůze" || cached === "dřepy" || cached === "kliky") setSelectedType(cached);
    } catch {}
  }, []);
  const [lightbox,setLightbox] = useState<{urls:string[];index:number}|null>(null);

  const runsQuery = useMemo(() => userRunsQuery(id || "__none__"), [id]);
  const runsState = useSharedFirestoreQuery<Run>(`admin-records:${id || "none"}`, runsQuery);

  const runs = useMemo(() => [...runsState.data].sort((a,b) => {
    const toMillis = (value: Run["timestamp"]) => {
      if (value instanceof Date) return value.getTime();
      if (value && "toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
      if (value && "seconds" in value && typeof value.seconds === "number") return value.seconds * 1000;
      return 0;
    };
    return toMillis(b.timestamp) - toMillis(a.timestamp);
  }), [runsState.data]);

  const handleDelete = async (runId:string) => {
    if (!window.confirm("Opravdu smazat tento záznam? Fotografie se odstraní také.")) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch("/api/runs/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ runId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Smazání se nepodařilo.");
      showAppToast("Záznam byl smazán.", "success");
    } catch(error) {
      console.error(error);
      showAppToast(error instanceof Error ? error.message : "Smazání se nepodařilo.", "error");
    }
  };

  if (adminAccess !== "allowed") return <><Navbar title="Záznamy uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} /><Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} /><main className="container"><div className="tile">Ověřuji administrátorská oprávnění…</div></main></>;

  return <>
    <Navbar title="Záznamy uživatele" onMenuClick={()=>setMenuVisible(true)} onHomeClick={()=>router.push("/")} />
    <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} />
    <main className="container admin-records-page">
      <div className="admin-page-intro">
        <span className="admin-eyebrow">ADMINISTRACE</span>
        <h1>Záznamy uživatele</h1>
        <p>Aktivity, fotografie a možnost moderace.</p>
      </div>

      <ActivityTypeSelector value={selectedType} onChange={setSelectedType} />

      <div className="list-container">
        {runs.filter(r => (r.type||"běh")===selectedType).map(run => {

          return <ActivityCard key={run.id}
            run={{...run, km:run.km??0,minuty:run.minuty??0,tempo:run.tempo??0}}
            activityType={selectedType}
            teamName={null}
            onPhotosClick={(urls, _fallback, startIndex = 0)=>setLightbox({urls,index:startIndex})}
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
