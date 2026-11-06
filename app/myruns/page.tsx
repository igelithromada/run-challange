"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, doc, getDoc, updateDoc, Timestamp, limit, startAfter, getDocs } from "firebase/firestore";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";

import Sidebar from "../components/Sidebar";
import ActivityCard from "../components/ActivityCard";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import { activityMetrics, formatPace } from "../lib/activityMetrics";

type RunData = {
  id: string; uid?: string; email?: string; nickname?: string;
  km: number; minuty: number; tempo: number; type?: string;
  imageUrl?: string; imageUrls?: string[]; imagePublicIds?: string[];
  timestamp?: Timestamp | { seconds: number } | Date;
};
const uploadToCloudinary = async (file: File) => {
  const data = new FormData();
  data.append("file", file); data.append("upload_preset", "lhota_unsigned");
  const response = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: data });
  if (!response.ok) throw new Error("Fotografii se nepodařilo nahrát.");
  const result = await response.json();
  if (!result.secure_url) throw new Error("Server fotografii nevrátil platnou adresu.");
  return { secureUrl: result.secure_url as string, publicId: typeof result.public_id === "string" ? result.public_id : "" };
};
const dateOf = (value: RunData["timestamp"]) => {
  if (value instanceof Date) return value;
  if (value && "toDate" in value && typeof value.toDate === "function") return value.toDate();
  if (value && "seconds" in value) return new Date(value.seconds * 1000);
  return new Date(0);
};
const toLocalInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
const durationString = (minutes: number) => {
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,"0")}`;
};
const formatTime = (minutes: number) => {
  const seconds = Math.max(0, Math.round(minutes * 60));
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2,"0")}″`;
};

export default function MyRunsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [olderRuns, setOlderRuns] = useState<RunData[]>([]);
  const [localUpdates, setLocalUpdates] = useState<Record<string, Partial<RunData>>>({});
  const [olderCursor, setOlderCursor] = useState<any>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [profile, setProfile] = useState({ nickname: "", avatarUrl: "" });
  const [confirmDelete, setConfirmDelete] = useState(true);

  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImageUrls, setShowImageUrls] = useState<string[] | null>(null);
  const [showImageRunId, setShowImageRunId] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedType, setSelectedType] = useState("běh");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [duration, setDuration] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!user) { router.push("/login"); return; }
      setUid(user.uid);
      getDoc(doc(db, "users", user.uid)).then(profileDoc => {
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setProfile({ nickname: data.nickname || "", avatarUrl: data.avatarUrl || "" });
          setConfirmDelete(data.confirmDelete !== false);
        }
      }).catch(err => console.error("Nepodařilo se načíst profil", err));
    });
    return () => unsubAuth();
  }, [router]);

  const runsQuery = useMemo(() => query(collection(db, "runs"), where("uid", "==", uid || "__no_user__"), orderBy("timestamp", "desc"), limit(30)), [uid]);
  const runsState = useSharedFirestoreQuery<RunData>("runs:user:" + (uid || "none"), runsQuery);
  const runs = useMemo(() => Array.from(new Map<string, RunData>([...runsState.data, ...olderRuns].map(run => [run.id, { ...run, ...(localUpdates[run.id] || {}) }] as const)).values()).map(run => ({
    ...run, km: Number(run.km) || 0, minuty: Number(run.minuty) || 0, tempo: Number(run.tempo) || 0
  })).sort((a,b) => dateOf(b.timestamp).getTime() - dateOf(a.timestamp).getTime()), [runsState.data, olderRuns, localUpdates]);
  const loading = runsState.loading;
  useEffect(() => { if (!runsState.loading && runsState.data.length < 30) setHasMore(false); }, [runsState.loading, runsState.data.length]);
  const loadOlderRuns = async () => {
    const cursor = olderCursor || runsState.lastDocument;
    if (!cursor || loadingOlder || !hasMore || !uid) return;
    setLoadingOlder(true);
    try {
      const next = await getDocs(query(collection(db, "runs"), where("uid", "==", uid), orderBy("timestamp", "desc"), startAfter(cursor), limit(30)));
      const items = next.docs.map(item => ({ id: item.id, ...item.data() } as RunData));
      setOlderRuns(previous => [...previous, ...items.filter(item => !previous.some(old => old.id === item.id) && !runsState.data.some(current => current.id === item.id))]);
      setOlderCursor(next.docs.length ? next.docs[next.docs.length - 1] : cursor);
      setHasMore(next.docs.length === 30);
    } catch (err) { console.error("Nepodařilo se načíst starší aktivity", err); setActionError("Starší záznamy se nepodařilo načíst."); }
    finally { setLoadingOlder(false); }
  };
  useEffect(() => {
    if (runsState.error) setError("Chyba při načítání dat.");
  }, [runsState.error]);

  const filteredRuns = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = dateOf(run.timestamp);
    if (dateFrom && date < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && date > new Date(dateTo + "T23:59:59")) return false;
    if (quickFilter !== "all") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (quickFilter === "week") { const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
      if (quickFilter === "month") start.setDate(1);
      if (date < start) return false;
    }
    return true;
  });
  const metrics = activityMetrics(filteredRuns);
  const totalKm = metrics.km;
  const totalMin = metrics.minutes;
  const avgTempo = metrics.pace;


  const handleEdit = (run: RunData) => {
    setEditingId(run.id); setKm(String(run.km)); setDuration(durationString(run.minuty));
    setActivityDate(toLocalInput(dateOf(run.timestamp))); setFile(null); setActionError("");
  };
  const handleUpdate = async (id: string) => {
    if (busy) return;
    const parsedKm = Number(km);
    const match = duration.trim().match(/^(\d{1,4}):([0-5]?\d)$/);
    const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    if (!Number.isFinite(parsedKm) || parsedKm <= 0 || !match || seconds <= 0 || !activityDate) {
      setActionError("Zkontroluj vzdálenost, čas ve formátu MM:SS a datum."); return;
    }
    if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      setActionError("Vyber obrázek do 10 MB."); return;
    }
    setBusy(true); setActionError("");
    try {
      const updates: Record<string, any> = {
        km: parsedKm, minuty: seconds / 60, tempo: (seconds / 60 / parsedKm).toFixed(2),
        timestamp: Timestamp.fromDate(new Date(activityDate))
      };
      if (file) {
        const uploaded = await uploadToCloudinary(file);
        const current = runs.find(run => run.id === id);
        const images = current?.imageUrls?.length ? current.imageUrls : current?.imageUrl ? [current.imageUrl] : [];
        updates.imageUrls = [...images, uploaded.secureUrl];
        updates.imageUrl = uploaded.secureUrl;
        if (uploaded.publicId) updates.imagePublicIds = [...(current?.imagePublicIds || []), uploaded.publicId];
      }
      await updateDoc(doc(db, "runs", id), updates);
      setLocalUpdates(previous => ({ ...previous, [id]: { ...(previous[id] || {}), ...updates } }));
      setEditingId(null); setFile(null);
    } catch (err) {
      console.error(err); setActionError(err instanceof Error ? err.message : "Záznam se nepodařilo upravit.");
    } finally { setBusy(false); }
  };
  const handleDeletePhoto = async () => {
    if (!showImageUrls || !showImageRunId || deletingPhoto) return;
    const index = currentImageIndex;
    if (!window.confirm("Opravdu chceš tuto fotografii trvale smazat?")) return;
    setDeletingPhoto(true); setActionError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/runs/photo", { method:"DELETE", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({runId:showImageRunId,index}) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Fotografii se nepodařilo smazat.");
      const next = Array.isArray(result.imageUrls) ? result.imageUrls : showImageUrls.filter((_,i)=>i!==index);
      if (next.length) { setShowImageUrls(next); setCurrentImageIndex(Math.min(index,next.length-1)); }
      else { setShowImageUrls(null); setShowImageRunId(null); setCurrentImageIndex(0); }
    } catch (err) { setActionError(err instanceof Error ? err.message : "Fotografii se nepodařilo smazat."); }
    finally { setDeletingPhoto(false); }
  };
  const handleDelete = async (id: string) => {
    if (confirmDelete && !window.confirm("Opravdu chceš tento záznam trvale smazat? Fotografie se odstraní také.")) return;
    setActionError("");
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
        body: JSON.stringify({ runId: id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Záznam se nepodařilo smazat.");
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Záznam se nepodařilo smazat.");
    }
  };
  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); }
    else if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "trainer") router.push("/trainer");
    else router.push("/" + item);
  };

  return <>
    <Navbar title="Moje aktivity" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
    <div className="container">
      <div className="control-caption">Typ aktivity</div>
      <ActivityTypeSelector value={selectedType as "běh" | "chůze"} onChange={setSelectedType} />
      <div className="control-caption">Rychlý filtr období</div>
      <div className="activity-quick-filters">
        {[["all","Vše"],["week","Tento týden"],["month","Tento měsíc"]].map(([value,label]) => <button key={value} className={quickFilter === value ? "active" : ""} onClick={() => setQuickFilter(value)}>{label}</button>)}
      </div>
      <div className="tile date-filter">
        <label className="date-field"><span>Od data</span><input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setQuickFilter("all"); }} /></label>
        <label className="date-field"><span>Do data</span><input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuickFilter("all"); }} /></label>
        {(dateFrom || dateTo) && <button className="date-clear" onClick={() => { setDateFrom(""); setDateTo(""); }}>Zrušit filtr</button>}
      </div>
      <div className="tile-group activity-summary-grid">
        <div className="tile"><span>Počet aktivit</span><strong>{filteredRuns.length}</strong></div>
        <div className="tile"><span>Celkem km</span><strong>{totalKm.toFixed(2)} km</strong></div>
        <div className="tile"><span>Čas</span><strong>{(totalMin / 60).toFixed(2)} h</strong></div>
        <div className="tile"><span>Prům. tempo</span><strong>{formatTime(avgTempo)} /km</strong></div>
      </div>
      <h2 className="centered-title">Moje záznamy</h2>
      {actionError && <p className="activity-action-error">{actionError}</p>}
      <div className="list-container" style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {filteredRuns.map(run => editingId === run.id ? <div key={run.id} className="tile list-tile activity-edit-form">
          <h3>Upravit aktivitu</h3>
          <label>Vzdálenost (km)<input type="number" min="0.1" step="0.01" value={km} onChange={e => setKm(e.target.value)} /></label>
          <label>Celkový čas (MM:SS)<input type="text" inputMode="numeric" value={duration} onChange={e => setDuration(e.target.value.replace(/[^0-9:]/g,"").slice(0,7))} placeholder="32:45" /></label>
          <label>Datum a čas<input type="datetime-local" value={activityDate} onChange={e => setActivityDate(e.target.value)} /></label>
          <label className="activity-edit-upload">Přidat fotografii<input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          {file && <small>Nová fotografie: {file.name}</small>}
          <div className="activity-edit-actions">
            <button disabled={busy} onClick={() => { setEditingId(null); setFile(null); setActionError(""); }}>Zrušit</button>
            <button disabled={busy} onClick={() => handleUpdate(run.id)}>{busy ? "Ukládám…" : "Uložit změny"}</button>
          </div>
        </div> : <ActivityCard key={run.id} run={run} nickname={profile.nickname || run.nickname || run.email?.split("@")[0] || "Anonym"} avatarUrl={profile.avatarUrl} activityType={selectedType} onEdit={() => handleEdit(run)} onDelete={() => handleDelete(run.id)} onPhotosClick={(images) => { setCurrentImageIndex(0); setShowImageUrls(images); setShowImageRunId(run.id); }} />)}
      </div>
      {showImageUrls && showImageUrls.length > 0 && <div className="activity-lightbox" onClick={() => setShowImageUrls(null)}>
        <img loading="lazy" decoding="async" src={cloudinaryImageUrl(showImageUrls[currentImageIndex], 1600)} alt={`Fotografie ${currentImageIndex + 1}`} onClick={e => e.stopPropagation()} />
        <div className="activity-lightbox-actions" onClick={e => e.stopPropagation()}>
          {showImageUrls.length > 1 && <button onClick={() => setCurrentImageIndex(i => (i - 1 + showImageUrls.length) % showImageUrls.length)} aria-label="Předchozí fotografie">❮</button>}
          <button onClick={() => void handleDeletePhoto()} disabled={deletingPhoto} aria-label="Smazat fotografii">{deletingPhoto ? "Mažu…" : "Smazat"}</button>
          <button onClick={() => { setShowImageUrls(null); setShowImageRunId(null); setCurrentImageIndex(0); }}>Zavřít</button>
          {showImageUrls.length > 1 && <button onClick={() => setCurrentImageIndex(i => (i + 1) % showImageUrls.length)} aria-label="Další fotografie">❯</button>}
        </div>
        {showImageUrls.length > 1 && <p>{currentImageIndex + 1} / {showImageUrls.length}</p>}
      </div>}
      {loading && runs.length === 0 && <LoadingSkeleton count={3} />}
      {hasMore && runs.length >= 30 && <button className="activity-load-more" onClick={loadOlderRuns} disabled={loadingOlder}>{loadingOlder ? "Načítám starší záznamy…" : "Načíst starší záznamy"}</button>}
      {error && <p style={{ color:"red" }}>{error}</p>}
      {!loading && filteredRuns.length === 0 && <div className="tile activity-empty-state"><strong>Zatím tu nic není.</strong><p>Pro zvolené období nemáš žádné záznamy. Zkus jiný filtr nebo přidej novou aktivitu.</p></div>}
    </div>
  </>;
}