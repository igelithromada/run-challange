"use client";

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
  formData.append("file", file);

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
  if (error instanceof Error && /network|fetch/i.test(error.message)) return "Nepodařilo se připojit k serveru. Zkontroluj internetové připojení.";
  return error instanceof Error ? error.message : "Aktivitu se nepodařilo uložit. Zkus to prosím znovu.";
};

export default function RunForm({ type, gpsDraft, onGpsDraftConsumed }: {
  type: "běh" | "chůze";
}) {
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
  const formPanelRef = useRef<HTMLElement | null>(null);
  const activityLabel = type === "chůze" ? "chůzi" : "běh";
  const activityPast = type === "chůze" ? "Chůze byla" : "Běh byl";

  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const minutesValue = durationMinutes.trim() === "" ? null : Number(durationMinutes);
  const secondsValue = durationSeconds.trim() === "" ? null : Number(durationSeconds);
  const parsedDuration =
    minutesValue !== null && secondsValue !== null &&
    Number.isInteger(minutesValue) && minutesValue >= 0 && minutesValue <= 9999 &&
    Number.isInteger(secondsValue) && secondsValue >= 0 && secondsValue <= 59
      ? minutesValue * 60 + secondsValue
      : null;
  const distanceValue = Number(km.replace(",", "."));
  const pace = distanceValue > 0 && parsedDuration !== null ? parsedDuration / distanceValue : null;

  const handleGpsFinished = (draft: { type: "běh" | "chůze"; km: number; seconds: number }) => {
    setKm(draft.km.toFixed(2));
    setDurationMinutes(String(Math.floor(draft.seconds / 60)));
    setDurationSeconds(String(draft.seconds % 60).padStart(2, "0"));
    setFiles([]);
    setDescription("");
    setActivityDate(localDateTime());
    setError("");
    setUploadStatus("");
    setShowGpsRecorder(false);
    setShowForm(true);
  };

  const reset = () => {
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

  const handleSubmit = async () => {
    if (saving) return;

    const kmVal = Number(km.replace(",", "."));
    if (!km.trim() || !Number.isFinite(kmVal) || kmVal <= 0 || parsedDuration === null || parsedDuration <= 0) {
      setError("Zadej platnou vzdálenost a celkový čas. Sekundy musí být v rozsahu 0–59.");
      return;
    }
    if (!activityDate || Number.isNaN(new Date(activityDate).getTime())) {
      setError("Zkontroluj datum a čas aktivity.");
      return;
    }
    if (files.length > 6 || files.some(file => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      setError("Vyber maximálně 6 obrázků, každý do 10 MB.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Pro uložení záznamu se nejprve přihlas.");
      return;
    }
    if (!navigator.onLine && files.length > 0) {
      setError("Fotografie lze přidat jen s připojením k internetu. Záznam můžeš uložit offline bez fotografií.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const imageUrls: string[] = [];
      const imagePublicIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Nahrávám fotografie ${i + 1}/${files.length}…`);
        const uploaded = await uploadToCloudinary(files[i]);
        imageUrls.push(uploaded.secureUrl);
        if (uploaded.publicId) imagePublicIds.push(uploaded.publicId);
      }

      setUploadStatus(navigator.onLine ? "Ukládám aktivitu…" : "Ukládám aktivitu offline…");

      let userData: Record<string, unknown> = {};
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) userData = profile as unknown as Record<string, unknown>;
      } catch {
        // Firestore může při offline režimu načtení profilu odmítnout.
        // Samotný zápis lze i tak zařadit do lokální fronty Firestore.
      }

      const teamIdsByType = (typeof userData.teamIdsByType === "object" && userData.teamIdsByType !== null)
        ? userData.teamIdsByType as Record<string, unknown>
        : {};
      const selectedTeamId = typeof teamIdsByType[type] === "string"
        ? teamIdsByType[type] as string
        : (type === "běh" && typeof userData.teamId === "string" ? userData.teamId : null);

      const runData = {
        uid: user.uid,
        email: user.email || undefined,
        nickname: typeof userData.nickname === "string" ? userData.nickname : "",
        avatarUrl: typeof userData.avatarUrl === "string" ? userData.avatarUrl : "",
        km: kmVal,
        minuty: parsedDuration / 60,
        tempo: (parsedDuration / 60 / kmVal).toFixed(2),
        type,
        description: description.trim().slice(0, 500),
        timestamp: new Date(activityDate),
        imageUrls,
        imagePublicIds,
        teamId: selectedTeamId || undefined,
        activityType: type,
        likedBy: [],
        likeCount: 0,
        commentCount: 0
      };

      try {
        // Primární cesta zachovává Firestore offline podporu.
        await createRun(runData);
      } catch (firestoreError) {
        const firestoreCode = firestoreError && typeof firestoreError === "object" && "code" in firestoreError
          ? String((firestoreError as { code?: unknown }).code || "")
          : "";

        // Pokud produkční Firestore Rules nejsou aktuálně synchronizované,
        // uložíme aktivitu přes zabezpečený serverový endpoint.
        if (!firestoreCode.includes("permission-denied") || !navigator.onLine) throw firestoreError;

        const token = await user.getIdToken(true);
        const response = await fetch("/api/runs/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ run: runData }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Aktivitu se nepodařilo uložit.");
      }

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
        <button type="button" className="run-primary-button" onClick={() => { reset(); setShowForm(true); }}>
          <Plus size={19} aria-hidden="true" /> Přidat záznam
        </button>
      )}

      {showForm && (
        <section ref={formPanelRef} className="run-form-panel" aria-label={`Nový záznam: ${type}`}>
          <div className="run-form-heading">
            <div>
              <span className="run-form-eyebrow">NOVÁ AKTIVITA</span>
              <h3>Přidat {activityLabel}</h3>
            </div>
            <button type="button" className="run-form-close" onClick={() => { setShowForm(false); setShowGpsRecorder(false); reset(); }} disabled={saving} aria-label="Zavřít formulář">
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          {!showGpsRecorder && (
            <button type="button" className="run-secondary-button gps-form-launch" onClick={() => setShowGpsRecorder(true)} disabled={saving}>
              <MapPin size={18} aria-hidden="true" /> Změřit trasu pomocí GPS
            </button>
          )}

          {showGpsRecorder && (
            <div className="run-form-gps-recorder">
              <ActivityRecorder type={type} onFinished={handleGpsFinished} />
            </div>
          )}

          {!showGpsRecorder && <label className="run-form-field">
            <span>Vzdálenost <small>km</small></span>
            <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label="Vzdálenost v kilometrech" type="number" min="0.1" step="0.01" inputMode="decimal" placeholder="Např. 5,2" value={km} onChange={e => setKm(e.target.value)} />
          </label>

          <div className="run-form-field">
            <span>Celkový čas <small>minuty a sekundy</small></span>
            <div className="run-form-time-fields">
              <label className="run-form-unit-field">
                <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label="Minuty" type="number" min="0" max="9999" step="1" inputMode="numeric" placeholder="min" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
              </label>
              <label className="run-form-unit-field">
                <input onFocus={e => scrollFieldIntoView(e.currentTarget)} aria-label="Sekundy" type="number" min="0" max="59" step="1" inputMode="numeric" placeholder="s" value={durationSeconds} onChange={e => setDurationSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
              </label>
            </div>
          </div>

          {pace !== null && pace > 0 && (
            <div className="run-form-pace" role="status">
              <span>Vypočítané tempo</span>
              <strong>{formatDuration(Math.round(pace))} /km</strong>
            </div>
          )}

          <label className="run-form-field">
            <span>Popis <small>volitelné</small></span>
            <textarea onFocus={e => scrollFieldIntoView(e.currentTarget)} className="run-form-description" maxLength={500} placeholder="Jaký byl dnešní běh nebo chůze?" value={description} onChange={e => setDescription(e.target.value)} />
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

          {uploadStatus && <p className="run-form-status" role="status">{uploadStatus}</p>}


          <div className="run-form-actions run-form-actions-single">
            <button type="button" className="run-primary-button" onClick={handleSubmit} disabled={saving}>
              <Save size={18} aria-hidden="true" /> {saving ? "Ukládám…" : "Uložit aktivitu"}
            </button>
          </div>
        </section>
      )}

      
    </div>
  );
}
