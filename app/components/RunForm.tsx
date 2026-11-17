"use client";
import { isStrengthActivity, activityLabel as labelFor } from "../lib/activity";
import { readFormDraft, saveFormDraft, readRecorderDraft, clearRecovery, draftPhotos } from "../lib/activityRecovery";
import { preparePhoto } from "../lib/preparePhoto";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../lib/firebase";
import { ImagePlus, MapPin, Plus, Save, X } from "lucide-react";
import { showAppToast } from "./AppToast";
import { createRun } from "../lib/services/runs";
import { getUserProfile } from "../lib/services/users";
import ActivityRecorder from "./ActivityRecorder";

const uploadToCloudinary = async (file: File) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Nejsi přihlášen.");

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("file", await preparePhoto(file));

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || typeof data.secureUrl !== "string") {
    throw new Error(data.error || "Fotografii se nepodařilo nahrát.");
  }

  return {
    secureUrl: data.secureUrl,
    publicId: typeof data.publicId === "string" ? data.publicId : "",
  };
};

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const translateSaveError = (error: unknown) => {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (code.includes("permission-denied")) return "Aktivitu se nepodařilo uložit kvůli oprávnění. Zkontroluj přihlášení a zkus to znovu.";
  if (code.includes("failed-precondition")) return "Aktivitu se nepodařilo uložit. Firebase čeká na dokončení nastavení databáze.";
  if (code.includes("unavailable")) return "Databáze je momentálně nedostupná. Zkus to za chvíli znovu.";
  if (error instanceof Error && /Function addDoc\(\) called with invalid data|Unsupported field value: undefined|found in field/i.test(error.message)) return "Aktivitu se nepodařilo uložit. Některý údaj nebyl vyplněný správně. Zkontroluj tým a zkus to znovu.";
  if (error instanceof Error && /permission|Permission denied|Missing or insufficient permissions/i.test(error.message)) return "Aktivitu se nepodařilo uložit kvůli oprávnění. Zkontroluj přihlášení a zkus to znovu.";
  if (error instanceof Error && /network|fetch/i.test(error.message)) return "Nepodařilo se připojit k serveru. Zkontroluj internetové připojení.";
  return error instanceof Error ? error.message : "Aktivitu se nepodařilo uložit. Zkus to prosím znovu.";
};

export default function RunForm({ type }: {
  type: import("../types").ActivityType;
}) {
  const strength = isStrengthActivity(type);
  const [showForm, setShowForm] = useState(false);
  const [showGpsRecorder, setShowGpsRecorder] = useState(false);
  const [km, setKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [activityDate, setActivityDate] = useState(localDateTime);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const submissionIdRef = useRef<string | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);
  const persistEnabled = useRef(false);
  const [recoverable,setRecoverable]=useState<"form"|"gps"|null>(null);
  const [draftMessage,setDraftMessage]=useState("");
  const [photoDraftError,setPhotoDraftError]=useState("");
  const ownerUid=auth.currentUser?.uid;
  const draftOwner=useRef(ownerUid);
  if(draftOwner.current!==ownerUid){draftOwner.current=ownerUid;persistEnabled.current=false;}
  const activityLabel = strength ? labelFor(type).toLowerCase() : type === "chůze" ? "chůzi" : "běh";
  const activityPast = "Aktivita byla";

  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const minutesValue = durationMinutes.trim() === "" ? (strength ? 0 : null) : Number(durationMinutes);
  const secondsValue = durationSeconds.trim() === "" ? (strength ? 0 : null) : Number(durationSeconds);
  const parsedDuration =
    minutesValue !== null && secondsValue !== null &&
    Number.isInteger(minutesValue) && minutesValue >= 0 && minutesValue <= 9999 &&
    Number.isInteger(secondsValue) && secondsValue >= 0 && secondsValue <= 59
      ? minutesValue * 60 + secondsValue
      : null;
  const distanceValue = Number(km.replace(",", "."));
  const pace = distanceValue > 0 && parsedDuration !== null ? parsedDuration / distanceValue : null;

  const handleGpsFinished = (draft: { type: import("../types").ActivityType; km: number; seconds: number }) => {
    setKm(draft.km.toFixed(2));
    setDurationMinutes(String(Math.floor(draft.seconds / 60)));
    setDurationSeconds(String(draft.seconds % 60).padStart(2, "0"));
    setFiles([]);
    setDescription("");
    const date=localDateTime();setActivityDate(date);
    persistEnabled.current=true;
    saveFormDraft(ownerUid,type,{km:draft.km.toFixed(2),minutes:String(Math.floor(draft.seconds/60)),seconds:String(draft.seconds%60).padStart(2,"0"),date,description:"",savedAt:Date.now()});
    setError("");setUploadStatus("");setShowGpsRecorder(false);setShowForm(true);
  };

  const reset = () => {
    persistEnabled.current=false;clearRecovery("form",ownerUid,type);
    if(ownerUid)void draftPhotos(ownerUid,type,null).catch(()=>{});
    setRecoverable(null);setDraftMessage("");setPhotoDraftError("");
    submissionIdRef.current = null;
    setKm("");
    setDurationMinutes("");
    setDurationSeconds("");
    setFiles([]);
    setDescription("");
    setActivityDate(localDateTime());
    setError("");
    setUploadStatus("");
    setShowGpsRecorder(false);
  };

  const scrollFieldIntoView = (element: HTMLElement | null) => {
    if (!element) return;
    window.setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 80);
  };

  useEffect(() => {
    if (error) showAppToast(error, "error");
  }, [error]);

  useEffect(() => {
    if (!showForm) return;
    const frame = window.requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm]);

  useEffect(() => {
    if (!showForm || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const handleViewportChange = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && formPanelRef.current?.contains(active)) {
        scrollFieldIntoView(active);
      }
    };
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [showForm]);

  useEffect(()=>{
    setRecoverable(null);
    const form=readFormDraft(ownerUid,type),gps=readRecorderDraft(ownerUid,type);
    if(gps&&(!form||gps.savedAt>form.savedAt))setRecoverable("gps");else if(form)setRecoverable("form");
  },[ownerUid,type]);
  useEffect(()=>{
    if(!persistEnabled.current||!showForm||showGpsRecorder)return;
    if(!km&&!durationMinutes&&!durationSeconds&&!description&&!files.length)return;
    const ok=saveFormDraft(ownerUid,type,{km,minutes:durationMinutes,seconds:durationSeconds,date:activityDate,description,submissionId:submissionIdRef.current||undefined,savedAt:Date.now()});
    setRecoverable("form");setDraftMessage(ok?"Rozepsaný záznam je uložený v tomto telefonu.":"Rozepsaný záznam se nepodařilo zálohovat do telefonu.");
  },[ownerUid,type,showForm,showGpsRecorder,km,durationMinutes,durationSeconds,activityDate,description,files]);
  useEffect(()=>{
    if(!persistEnabled.current||!showForm||showGpsRecorder||!ownerUid)return;
    let active=true;
    void draftPhotos(ownerUid,type,files).then(()=>{if(active)setPhotoDraftError("");}).catch(()=>{if(active)setPhotoDraftError("Fotografie se nepodařilo zálohovat. Po obnovení je případně vyber znovu.");});
    return()=>{active=false;};
  },[ownerUid,type,showForm,showGpsRecorder,files]);
  const openForm=async()=>{
    if(recoverable==="gps"){setShowForm(true);setShowGpsRecorder(true);return;}
    const stored=readFormDraft(ownerUid,type);
    if(stored){
      setKm(stored.km);setDurationMinutes(stored.minutes);setDurationSeconds(stored.seconds);setActivityDate(stored.date);setDescription(stored.description);
      submissionIdRef.current=stored.submissionId||null;
      if(ownerUid)try{const restoredFiles=await draftPhotos(ownerUid,type);if(auth.currentUser?.uid!==ownerUid)return;setFiles(restoredFiles);}catch{setPhotoDraftError("Fotografie případně vyber znovu.");}
    }else reset();
    persistEnabled.current=true;setShowForm(true);
  };

  const handleSubmit = async () => {
    if (saving) return;

    const kmVal = Number(km.replace(",", "."));
    if (!km.trim() || !Number.isFinite(kmVal) || kmVal <= 0 || parsedDuration === null || (!strength && parsedDuration <= 0) || (strength && (!Number.isInteger(kmVal) || kmVal > 100000))) {
      setError(strength ? "Zadej celý počet opakování od 1 do 100 000. Čas je volitelný." : "Zadej platnou vzdálenost a celkový čas. Sekundy musí být v rozsahu 0–59.");
      return;
    }
    if (!activityDate || Number.isNaN(new Date(activityDate).getTime())) {
      setError("Zkontroluj datum a čas aktivity.");
      return;
    }
    if (files.length > 6 || files.some(file => !file.type.startsWith("image/"))) {
      setError("Vyber maximálně 6 fotografií.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Pro uložení záznamu se nejprve přihlas.");
      return;
    }
    if (!navigator.onLine) {
      setError("Jsi bez internetu. Záznam zůstává rozepsaný v tomto telefonu; odešli ho po připojení.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const imageUrls: string[] = [];
      const imagePublicIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Zmenšuji a nahrávám fotografii ${i + 1}/${files.length}…`);
        const uploaded = await uploadToCloudinary(files[i]);
        imageUrls.push(uploaded.secureUrl);
        if (uploaded.publicId) imagePublicIds.push(uploaded.publicId);
      }

      setUploadStatus("Ukládám aktivitu…");

      let userData: Record<string, unknown> = {};
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) userData = profile as unknown as Record<string, unknown>;
      } catch {
        // Profil není pro vytvoření aktivity povinný.
      }

      const runData = {
        uid: user.uid,
        email: user.email || "",
        nickname: typeof userData.nickname === "string" ? userData.nickname : "",
        avatarUrl: typeof userData.avatarUrl === "string" ? userData.avatarUrl : "",
        km: strength ? 0 : kmVal,
        repetitions: strength ? kmVal : 0,
        minuty: parsedDuration / 60,
        tempo: strength ? "0" : (parsedDuration / 60 / kmVal).toFixed(2),
        type,
        description: description.trim().slice(0, 500),
        timestamp: new Date(activityDate),
        imageUrls,
        imagePublicIds,
        activityType: type,
        likedBy: [],
        likeCount: 0,
        commentCount: 0
      };

      submissionIdRef.current ||= crypto.randomUUID();
      saveFormDraft(ownerUid,type,{km,minutes:durationMinutes,seconds:durationSeconds,date:activityDate,description,submissionId:submissionIdRef.current,savedAt:Date.now()});
      await createRun(runData, submissionIdRef.current);
      reset();
      setShowForm(false);
      showAppToast(
        navigator.onLine
          ? `${activityPast} úspěšně uložena.`
          : `${activityPast} uložena offline a po připojení se synchronizuje.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      const message=translateSaveError(err);
      setError(message);
    } finally {
      setSaving(false);
      setUploadStatus("");
    }
  };

  return (
    <div className="run-form-shell">
      {!showForm && (
        <button type="button" className="run-primary-button" onClick={() => void openForm()}>
          <Plus size={19} aria-hidden="true" /> {recoverable ? "Pokračovat v rozpracované aktivitě" : "Přidat záznam"}
        </button>
      )}

      {!showForm&&recoverable&&<p className="draft-recovery-note">Máš uloženou rozpracovanou aktivitu v tomto telefonu.</p>}
      {showForm && (
        <section ref={formPanelRef} className="run-form-panel" aria-label={`Nový záznam: ${type}`}>
          <div className="run-form-heading">
            <div>
              <span className="run-form-eyebrow">NOVÁ AKTIVITA</span>
              <h3>Přidat {activityLabel}</h3>
            </div>
            <button type="button" className="run-form-close" onClick={() => { setShowForm(false); setShowGpsRecorder(false); setRecoverable(readRecorderDraft(ownerUid,type)?"gps":readFormDraft(ownerUid,type)?"form":null); }} disabled={saving} aria-label="Zavřít formulář">
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          {!strength && !showGpsRecorder && (
            <button type="button" className="run-secondary-button gps-form-launch" onClick={() => setShowGpsRecorder(true)} disabled={saving}>
              <MapPin size={18} aria-hidden="true" /> Změřit trasu pomocí GPS
            </button>
          )}

          {showGpsRecorder && !strength && (type === "běh" || type === "chůze") ? (
            <div className="run-form-gps-recorder">
              <ActivityRecorder ownerUid={ownerUid} type={type} onFinished={handleGpsFinished} />
            </div>
          ) : (
            <>
              <label className="run-form-field">
                <span>{strength ? "Počet opakování" : "Vzdálenost"} <small>{strength ? "" : "km"}</small></span>
                <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label={strength ? "Počet opakování" : "Vzdálenost v kilometrech"} type="number" min={strength ? "1" : "0.1"} step={strength ? "1" : "0.01"} inputMode={strength ? "numeric" : "decimal"} placeholder={strength ? "Např. 30" : "Např. 5,2"} value={km} onChange={e => setKm(e.target.value)} />
              </label>

              <div className="run-form-field">
                <span>Celkový čas <small>{strength ? "volitelné" : "minuty a sekundy"}</small></span>
                <div className="run-form-time-fields">
                  <label className="run-form-unit-field">
                    <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label="Minuty" type="number" min="0" max="9999" step="1" inputMode="numeric" placeholder="min" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
                  </label>
                  <label className="run-form-unit-field">
                    <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label="Sekundy" type="number" min="0" max="59" step="1" inputMode="numeric" placeholder="s" value={durationSeconds} onChange={e => setDurationSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
                  </label>
                </div>
              </div>

              {!strength && pace !== null && pace > 0 && (
                <div className="run-form-pace" role="status">
                  <span>Vypočítané tempo</span>
                  <strong>{formatDuration(Math.round(pace))} /km</strong>
                </div>
              )}

              <label className="run-form-field">
                <span>Popis <small>volitelné</small></span>
                <textarea onFocus={e => scrollFieldIntoView(e.currentTarget)} className="run-form-description" maxLength={500} placeholder="Jaká byla dnešní aktivita?" value={description} onChange={e => setDescription(e.target.value)} />
              </label>

              <label className="run-form-field">
                <span>Datum a čas aktivity</span>
                <input onFocus={e => scrollFieldIntoView(e.currentTarget)} type="datetime-local" value={activityDate} onChange={e => setActivityDate(e.target.value)} />
              </label>

              <label className="run-form-upload">
                <ImagePlus size={19} aria-hidden="true" />
                <span>{files.length ? `Vybráno fotografií: ${files.length}` : "Přidat fotografie (max. 6)"}</span>
                <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 6))} />
              </label>

              {previews.length > 0 && (
                <div className="run-form-previews">
                  {previews.map((item, index) => (
                    <div key={item.url}>
                      <img src={item.url} alt={`Náhled fotografie ${index + 1}`} />
                      <button type="button" onClick={() => setFiles(current => current.filter(file => file !== item.file))} aria-label={`Odebrat fotografii ${index + 1}`}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {draftMessage&&<p className="run-form-status" role="status">{draftMessage}</p>}
              {photoDraftError&&<p className="run-form-status" role="status">{photoDraftError}</p>}
              {(km||description||durationMinutes)&&<button type="button" className="run-secondary-button" disabled={saving} onClick={()=>{if(window.confirm("Zahodit rozepsaný záznam?")){reset();setShowForm(false);}}}>Zahodit rozepsaný záznam</button>}
              {uploadStatus && <p className="run-form-status" role="status">{uploadStatus}</p>}

              <div className="run-form-actions run-form-actions-single">
                <button type="button" className="run-primary-button" onClick={handleSubmit} disabled={saving}>
                  <Save size={18} aria-hidden="true" /> {saving ? "Ukládám…" : "Uložit aktivitu"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      
    </div>
  );
}
