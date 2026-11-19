"use client";
import Metric from "../components/Metric";
import PhotoViewer from "../components/PhotoViewer";
import { isStrengthActivity, activityAmount, parseActivityDuration, recordActivityType, validateActivityValues } from "../lib/activity";
import { parseActivityDate } from "../lib/runData";
import FormField from "../components/FormField";
import { uploadPhoto } from "../lib/uploadPhoto";
import { useEffect, useMemo, useRef, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";

import Sidebar from "../components/Sidebar";
import ActivityCard from "../components/ActivityCard";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector, { ActivityTypeIcon } from "../components/ActivityTypeSelector";
import { ListChecks } from "lucide-react";
import { formatResultDuration } from "../lib/results";
import { activityMetrics, formatCompactActivityTime, formatMetricNumber } from "../lib/activityMetrics";
import { showAppToast } from "../components/AppToast";
import type { RunData as BaseRunData, ActivityType } from "../types";
import { personalHistoryQuery, updateRun } from "../lib/services/runs";

type RunData = BaseRunData;
const dateOf = (timestamp: RunData["timestamp"]) => parseActivityDate(timestamp) ?? new Date(0);
const toLocalInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
export default function MyRunsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [localUpdates, setLocalUpdates] = useState<Record<string, Partial<RunData>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const pageActive = useRef(true);

  useEffect(() => { pageActive.current = true; return () => { pageActive.current = false; }; }, []);

  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImageUrls, setShowImageUrls] = useState<string[] | null>(null);
  const [showImageRunId, setShowImageRunId] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (cached === "běh" || cached === "chůze" || cached === "dřepy" || cached === "kliky") setSelectedType(cached);
    } catch {}
  }, []);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!active) return;
      if (!user) { router.push("/login"); return; }
      setLocalUpdates({});setDeletedIds(new Set());
      setUid(user.uid);
    });
    return () => { active = false; unsubAuth(); };
  }, [router]);

  const runsQuery = useMemo(() => personalHistoryQuery(uid || "__no_user__"), [uid]);
  const runsState = useSharedFirestoreQuery<RunData>("personal-history:v2:" + (uid || "none"), runsQuery);
  const runs = useMemo(() => runsState.data.filter(run => run.uid === uid && !deletedIds.has(run.id)).map(run => ({ ...run, ...(localUpdates[run.id] || {}) })).sort((a,b) => dateOf(b.timestamp).getTime() - dateOf(a.timestamp).getTime()), [runsState.data, localUpdates, deletedIds, uid]);
  const loading = runsState.loading;
  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => { setVisibleCount(30); }, [selectedType, dateFrom, dateTo]);
  useEffect(() => {
    // Krátký Firestore výpadek nesmí rušit už načtený seznam aktivit.
    // Chybu zobrazíme jen tehdy, když se nepodařilo načíst vůbec žádná data.
    if (runsState.error && !runsState.loading && runsState.data.length === 0) {
      setError("Chyba při načítání dat.");
    } else if (!runsState.error) {
      setError("");
    }
  }, [runsState.error, runsState.loading, runsState.data.length ]);

  useEffect(() => { if (error) showAppToast(error, "error"); }, [error]);
  useEffect(() => { if (actionError) showAppToast(actionError, "error"); }, [actionError]);

  const invalidDates = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const filteredRuns = invalidDates ? [] : runs.filter(run => {
    if (recordActivityType(run) !== selectedType) return false;
    const date = dateOf(run.timestamp);
    if (dateFrom && date < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && date > new Date(dateTo + "T23:59:59.999")) return false;
    return true;
  });
  const strength = isStrengthActivity(selectedType);
  useEffect(() => { setEditingId(null); }, [selectedType]);
  const metrics = activityMetrics(filteredRuns);
  const summaryUnavailable = invalidDates ? "—" : loading && runs.length === 0 ? "…" : runsState.error && runs.length === 0 ? "—" : null;
  const totalKm = metrics.km;
  const totalMin = metrics.minutes;
  const avgTempo = metrics.pace;


  const handleEdit = (run: RunData) => {
    setEditingId(run.id); setKm(String(activityAmount(run)));
    const totalSeconds = Math.round(Number(run.minuty) * 60); setDurationMinutes(String(Math.floor(totalSeconds / 60))); setDurationSeconds(String(totalSeconds % 60).padStart(2,"0"));
    setActivityDate(toLocalInput(dateOf(run.timestamp))); setDescription(run.description || ""); setFile(null); setActionError("");
  };
  const handleUpdate = async (id: string) => {
    if (busy) return;
    const amount = Number(km.replace(",", "."));
    const seconds = parseActivityDuration(durationMinutes, durationSeconds);
    const date = new Date(activityDate);
    const values = seconds === null ? null : validateActivityValues(selectedType, {
      km: amount, repetitions: amount, minuty: seconds / 60,
    });
    if (!values || !Number.isFinite(date.getTime())) {
      setActionError("Zkontroluj vzdálenost nebo počet opakování, datum a čas. Sekundy musí být v rozsahu 0–59.");
      return;
    }
    if (file && (!file.type.startsWith("image/"))) {
      setActionError("Vyber fotografii."); return;
    }
    if(file && (runs.find(run => run.id===id)?.imageUrls?.length || 0)>=6){setActionError("U aktivity může být nejvýše šest fotografií.");return;}
    setBusy(true); setActionError("");
    try {
      const updates: Partial<RunData> = {
        ...values,
        timestamp: Timestamp.fromDate(date),
        description: description.trim().slice(0, 500)
      };
      if (file) {
        const uploaded = await uploadPhoto(file);
        const current = runs.find(run => run.id === id);
        const images = current?.imageUrls?.length ? current.imageUrls : current?.imageUrl ? [current.imageUrl] : [];
        updates.imageUrls = [...images, uploaded.secureUrl];
        updates.imageUrl = uploaded.secureUrl;
        if (uploaded.publicId) updates.imagePublicIds = [...(current?.imagePublicIds || []), uploaded.publicId];
      }
      await updateRun(id, updates);
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
      setLocalUpdates(previous => ({ ...previous, [showImageRunId]: { ...(previous[showImageRunId] || {}), imageUrls: next, imageUrl: next[next.length-1] || "" } }));
      if (next.length) { setShowImageUrls(next); setCurrentImageIndex(Math.min(index,next.length-1)); }
      else { setShowImageUrls(null); setShowImageRunId(null); setCurrentImageIndex(0); }
    } catch (err) { setActionError(err instanceof Error ? err.message : "Fotografii se nepodařilo smazat."); }
    finally { setDeletingPhoto(false); }
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm("Opravdu chceš tento záznam trvale smazat? Fotografie se odstraní také.")) return;
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
      setDeletedIds(previous => {
        const next = new Set(previous);
        next.add(id);
        return next;
      });
      setLocalUpdates(previous => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Záznam se nepodařilo smazat.");
    }
  };

  return <>
    <Navbar title="Moje aktivity" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />
    <div className="container myruns-page">
      <div className="control-caption">Typ aktivity</div>
      <ActivityTypeSelector value={selectedType as import("../types").ActivityType} onChange={setSelectedType} />

      <details className="activity-date-range">
        <summary>Období{(dateFrom || dateTo) && <span>{dateFrom ? dateFrom.split("-").reverse().join(". ") : "začátek"} – {dateTo ? dateTo.split("-").reverse().join(". ") : "dnes"}</span>}</summary>
        <div className="tile date-filter">
          <label className="date-field"><span>Od data</span><input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); }} /></label>
          <label className="date-field"><span>Do data</span><input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); }} /></label>
          {(dateFrom || dateTo) && <button className="date-clear" onClick={() => { setDateFrom(""); setDateTo(""); }}>Zrušit filtr</button>}
        </div>
      </details>
      {invalidDates && <p role="alert">Datum od nesmí být později než datum do.</p>}
      <div data-metric-layout="summary" className="tile-group activity-summary-grid">
        {strength
          ? <Metric icon={<ActivityTypeIcon type={selectedType}/>} label="Celkem opakování" tone="repetitions" value={summaryUnavailable ?? formatMetricNumber(metrics.repetitions, 0)}/>
          : <Metric label="Celkem km" tone="distance" value={summaryUnavailable ?? formatMetricNumber(totalKm)} unit={summaryUnavailable ? undefined : "km"}/>}
        <Metric label="Čas" tone="time" value={summaryUnavailable ?? (strength && totalMin === 0 ? "—" : formatResultDuration(totalMin))}/>
        {!strength && <Metric label="Prům. tempo" tone="pace" value={summaryUnavailable ?? (avgTempo > 0 ? formatCompactActivityTime(avgTempo) : "—")} unit={!summaryUnavailable && avgTempo > 0 ? "/km" : undefined}/>}
        <Metric icon={<ListChecks/>} label="Počet aktivit" tone="count" value={summaryUnavailable ?? formatMetricNumber(filteredRuns.length, 0)}/>
      </div>
      <h2 className="centered-title">Moje záznamy</h2>

      <div className="list-container myruns-list">
        {filteredRuns.slice(0, visibleCount).map(run => editingId === run.id ? <section key={run.id} className="run-form-panel activity-edit-form" aria-label="Upravit aktivitu">
          <div className="run-form-heading"><div><span className="run-form-eyebrow">ÚPRAVA AKTIVITY</span><h3>Upravit aktivitu</h3></div><button type="button" className="run-form-close" onClick={() => { setEditingId(null); setFile(null); setActionError(""); }} disabled={busy} aria-label="Zavřít formulář">×</button></div>
          <FormField className="run-form-field" label={strength ? "Počet opakování" : "Vzdálenost"} hint={strength ? undefined : "km"}><input type="number" min={strength ? "1" : "0.1"} step={strength ? "1" : "0.01"} value={km} onChange={e => setKm(e.target.value)} /></FormField>
          <div className="run-form-field"><span>Celkový čas <small>{strength ? "volitelné" : "minuty a sekundy"}</small></span><div className="run-form-time-fields"><label className="run-form-unit-field"><input aria-label="Minuty" type="number" min="0" value={durationMinutes} onChange={e=>setDurationMinutes(e.target.value.replace(/[^0-9]/g,"").slice(0,4))}/></label><label className="run-form-unit-field"><input aria-label="Sekundy" type="number" min="0" max="59" value={durationSeconds} onChange={e=>setDurationSeconds(e.target.value.replace(/[^0-9]/g,"").slice(0,2))}/></label></div></div>
          <FormField className="run-form-field" label="Popis" hint="volitelné"><textarea className="run-form-description" maxLength={500} placeholder="Jaká byla dnešní aktivita?" value={description} onChange={e => setDescription(e.target.value)} /></FormField>
          <FormField className="run-form-field" label="Datum a čas aktivity"><input type="datetime-local" value={activityDate} onChange={e => setActivityDate(e.target.value)} /></FormField>
          <label className="run-form-upload"><span>{file ? `Vybraná fotografie: ${file.name}` : "Přidat fotografii (volitelné)"}</span><input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <div className="run-form-actions run-form-actions-single"><button type="button" className="run-primary-button" disabled={busy} onClick={() => handleUpdate(run.id)}>{busy ? "Ukládám…" : "Uložit změny"}</button></div>
        </section> : <ActivityCard key={run.id} run={run} activityType={selectedType} onEdit={() => handleEdit(run)} onDelete={() => handleDelete(run.id)} onPhotosClick={(images, _fallback, startIndex = 0) => { setCurrentImageIndex(startIndex); setShowImageUrls(images); setShowImageRunId(run.id); }} />)}
      </div>
      {showImageUrls && showImageUrls.length>0 && <PhotoViewer url={showImageUrls[currentImageIndex]} onClose={()=>{setShowImageUrls(null);setShowImageRunId(null);setCurrentImageIndex(0);}} onMove={direction=>setCurrentImageIndex(index=>(index+direction+showImageUrls.length)%showImageUrls.length)} onDelete={()=>void handleDeletePhoto()} deleting={deletingPhoto}/>}
      {loading && runs.length === 0 && <LoadingSkeleton count={3} />}
      {visibleCount < filteredRuns.length && <button className="activity-load-more" onClick={() => setVisibleCount(count => count + 30)}>Zobrazit další záznamy</button>}

      {!invalidDates && !loading && !runsState.error && filteredRuns.length === 0 && <div className="tile activity-empty-state"><strong>Zatím tu nic není.</strong><p>Pro zvolené období nemáš žádné záznamy. Zkus jiný filtr nebo přidej novou aktivitu.</p></div>}
    </div>
  </>;
}