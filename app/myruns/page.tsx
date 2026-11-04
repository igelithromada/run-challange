"use client";
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import { Footprints } from "lucide-react";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import ActivityCard from "../components/ActivityCard";

type RunData = {
  id: string; uid?: string; email?: string; nickname?: string;
  km: number; minuty: number; tempo: number; type?: string;
  imageUrl?: string; imageUrls?: string[];
  timestamp?: Timestamp | { seconds: number } | Date;
};
const uploadToCloudinary = async (file: File) => {
  const data = new FormData();
  data.append("file", file); data.append("upload_preset", "lhota_unsigned");
  const response = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: data });
  if (!response.ok) throw new Error("Fotografii se nepodařilo nahrát.");
  return (await response.json()).secure_url as string;
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
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [profile, setProfile] = useState({ nickname: "", avatarUrl: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImageUrls, setShowImageUrls] = useState<string[] | null>(null);
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
    let unsubRuns: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubRuns?.(); unsubRuns = null;
      if (!user) { setLoading(false); router.push("/login"); return; }
      getDoc(doc(db, "users", user.uid)).then(profileDoc => {
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setProfile({ nickname: data.nickname || "", avatarUrl: data.avatarUrl || "" });
        }
      }).catch(err => console.error("Nepodařilo se načíst profil", err));
      unsubRuns = onSnapshot(query(collection(db, "runs"), where("uid", "==", user.uid)), snap => {
        const items = snap.docs.map(item => {
          const data = item.data();
          return { id: item.id, ...data, km: Number(data.km) || 0, minuty: Number(data.minuty) || 0, tempo: Number(data.tempo) || 0 } as RunData;
        }).sort((a,b) => dateOf(b.timestamp).getTime() - dateOf(a.timestamp).getTime());
        setRuns(items); setLoading(false);
      }, err => { console.error(err); setError("Chyba při načítání dat."); setLoading(false); });
    });
    return () => { unsubAuth(); unsubRuns?.(); };
  }, [router]);

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
  const totalKm = filteredRuns.reduce((sum, run) => sum + run.km, 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + run.minuty, 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const longestRun = filteredRuns.reduce<RunData | null>((best, run) => !best || run.km > best.km ? run : best, null);
  const fastestRun = filteredRuns.reduce<RunData | null>((best, run) => !best || (run.tempo > 0 && run.tempo < best.tempo) ? run : best, null);

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
      const updates: Record<string, unknown> = {
        km: parsedKm, minuty: seconds / 60, tempo: (seconds / 60 / parsedKm).toFixed(2),
        timestamp: Timestamp.fromDate(new Date(activityDate))
      };
      if (file) {
        const imageUrl = await uploadToCloudinary(file);
        const current = runs.find(run => run.id === id);
        const images = current?.imageUrls?.length ? current.imageUrls : current?.imageUrl ? [current.imageUrl] : [];
        updates.imageUrls = [...images, imageUrl];
        updates.imageUrl = imageUrl;
      }
      await updateDoc(doc(db, "runs", id), updates);
      setEditingId(null); setFile(null);
    } catch (err) {
      console.error(err); setActionError(err instanceof Error ? err.message : "Záznam se nepodařilo upravit.");
    } finally { setBusy(false); }
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm("Opravdu chceš tento záznam trvale smazat?")) return;
    setActionError("");
    try { await deleteDoc(doc(db, "runs", id)); }
    catch (err) { console.error(err); setActionError("Záznam se nepodařilo smazat."); }
  };
  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); }
    else if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else router.push("/" + item);
  };

  return <>
    <Navbar title="Moje aktivity" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
    <div className="container">
      <div className="control-caption">Typ aktivity</div>
      <div className="tile-group">
        <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}><svg className="run-profile-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="21" cy="5" r="3" fill="currentColor"/><path d="M17 10l-5 5 5 3 4-5 5 2M12 15l-6-1-3 4M17 18l-4 6-7 4M20 18l4 5 5 2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg> Běh</button>
        <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}><Footprints size={25} strokeWidth={2.8} /> Chůze</button>
      </div>
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
        <div className="tile">Počet aktivit<br />{filteredRuns.length}</div>
        <div className="tile">Celkem km<br />{totalKm.toFixed(2)}</div>
        <div className="tile">Čas<br />{(totalMin / 60).toFixed(2)} h</div>
        <div className="tile">Prům. tempo<br />{formatTime(avgTempo)}</div>
      </div>
      {longestRun && <div className="tile">🏆 Nejdelší {selectedType}: {longestRun.km} km za {formatTime(longestRun.minuty)} ({formatTime(longestRun.tempo)} /km)</div>}
      {fastestRun && <div className="tile">⚡ Nejrychlejší {selectedType}: {fastestRun.km} km za {formatTime(fastestRun.minuty)} ({formatTime(fastestRun.tempo)} /km)</div>}
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
        </div> : <ActivityCard key={run.id} run={run} nickname={profile.nickname || run.nickname || run.email?.split("@")[0] || "Anonym"} avatarUrl={profile.avatarUrl} activityType={selectedType} onEdit={() => handleEdit(run)} onDelete={() => handleDelete(run.id)} onPhotosClick={images => { setCurrentImageIndex(0); setShowImageUrls(images); }} />)}
      </div>
      {showImageUrls && showImageUrls.length > 0 && <div className="activity-lightbox" onClick={() => setShowImageUrls(null)}>
        <img src={showImageUrls[currentImageIndex]} alt={`Fotografie ${currentImageIndex + 1}`} onClick={e => e.stopPropagation()} />
        <div className="activity-lightbox-actions" onClick={e => e.stopPropagation()}>
          {showImageUrls.length > 1 && <button onClick={() => setCurrentImageIndex(i => (i - 1 + showImageUrls.length) % showImageUrls.length)} aria-label="Předchozí fotografie">❮</button>}
          <button onClick={() => { setShowImageUrls(null); setCurrentImageIndex(0); }}>Zavřít</button>
          {showImageUrls.length > 1 && <button onClick={() => setCurrentImageIndex(i => (i + 1) % showImageUrls.length)} aria-label="Další fotografie">❯</button>}
        </div>
        {showImageUrls.length > 1 && <p>{currentImageIndex + 1} / {showImageUrls.length}</p>}
      </div>}
      {loading && <p>Načítám…</p>}
      {error && <p style={{ color:"red" }}>{error}</p>}
      {!loading && filteredRuns.length === 0 && <div className="tile activity-empty-state"><strong>Zatím tu nic není.</strong><p>Pro zvolené období nemáš žádné záznamy. Zkus jiný filtr nebo přidej novou aktivitu.</p></div>}
    </div>
  </>;
}
