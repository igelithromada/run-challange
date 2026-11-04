"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "lhota_unsigned");
  const res = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Chyba při nahrávání fotografie.");
  const data = await res.json();
  return data.secure_url as string;
};
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function RunForm({ type }: { type: string }) {
  const [showForm, setShowForm] = useState(false);
  const [km, setKm] = useState("");
  const [duration, setDuration] = useState("");
  const [activityDate, setActivityDate] = useState(localDateTime);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const parsedDuration = (() => {
    const match = duration.trim().match(/^(\d{1,4}):([0-5]?\d)$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  })();
  const pace = Number(km) > 0 && parsedDuration !== null ? parsedDuration / Number(km) : null;

  const reset = () => {
    setKm(""); setDuration(""); setFiles([]); setActivityDate(localDateTime()); setError(""); setUploadStatus("");
  };

  const handleSubmit = async () => {
    if (saving) return;
    const kmVal = Number(km);
    if (!km.trim() || !Number.isFinite(kmVal) || kmVal <= 0 || parsedDuration === null || parsedDuration <= 0) {
      setError("Zadej platnou vzdálenost a čas ve formátu minuty:sekundy (např. 32:45).");
      return;
    }
    if (!activityDate || Number.isNaN(new Date(activityDate).getTime())) {
      setError("Zkontroluj datum a čas aktivity."); return;
    }
    if (files.length > 6 || files.some(file => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      setError("Vyber maximálně 6 obrázků, každý do 10 MB."); return;
    }
    const user = auth.currentUser;
    if (!user) { setError("Pro uložení záznamu se nejprve přihlas."); return; }

    setSaving(true); setError(""); setSuccess("");
    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Nahrávám fotografie ${i + 1}/${files.length}…`);
        imageUrls.push(await uploadToCloudinary(files[i]));
      }
      setUploadStatus("Ukládám aktivitu…");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      await addDoc(collection(db, "runs"), {
        uid: user.uid, email: user.email, avatarUrl: userData.avatarUrl || "",
        km: kmVal, minuty: parsedDuration / 60, tempo: (parsedDuration / 60 / kmVal).toFixed(2),
        type, timestamp: new Date(activityDate), imageUrls,
        teamId: userData.teamId || userData.joinedTeam || null
      });
      reset(); setShowForm(false);
      setSuccess(`${type[0].toUpperCase() + type.slice(1)} byl úspěšně uložen.`);
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Chyba při ukládání záznamu.");
    } finally { setSaving(false); setUploadStatus(""); }
  };

  return (
    <div style={{ textAlign: "center", fontFamily: "'Poppins', sans-serif", marginTop: "0rem" }}>
      {!showForm && <button onClick={() => { reset(); setShowForm(true); }} style={buttonStyle}>➕ Přidat nový záznam</button>}
      {showForm && (
        <div className="run-form-panel">
          <label className="run-form-field">Vzdálenost (km)
            <input type="number" min="0.1" step="0.01" inputMode="decimal" placeholder="Např. 5,2" value={km} onChange={e => setKm(e.target.value)} style={inputStyle} />
          </label>
          <label className="run-form-field">Celkový čas (minuty:sekundy)
            <input type="text" inputMode="numeric" placeholder="Např. 32:45" value={duration} onChange={e => setDuration(e.target.value.replace(/[^0-9:]/g, "").slice(0, 7))} style={inputStyle} />
          </label>
          {pace !== null && pace > 0 && <div className="run-form-pace">Vypočítané tempo <strong>{formatDuration(Math.round(pace))} /km</strong></div>}
          <label className="run-form-field">Datum a čas aktivity
            <input type="datetime-local" value={activityDate} onChange={e => setActivityDate(e.target.value)} style={inputStyle} />
          </label>
          <label className="run-form-upload">
            <span>📷 {files.length ? `Vybráno fotografií: ${files.length}` : "Přidat fotografie (max. 6)"}</span>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 6))} />
          </label>
          {previews.length > 0 && <div className="run-form-previews">{previews.map((item, index) => <div key={item.url}><img src={item.url} alt={`Náhled ${index + 1}`} /><button type="button" onClick={() => setFiles(current => current.filter(file => file !== item.file))} aria-label="Odebrat fotografii">×</button></div>)}</div>}
          {uploadStatus && <p className="run-form-status">{uploadStatus}</p>}
          <div className="run-form-actions">
            <button onClick={() => { setShowForm(false); reset(); }} style={buttonStyle} disabled={saving}>Zavřít</button>
            <button onClick={handleSubmit} style={{ ...buttonStyle, background: "#eee", color: "#333", opacity: saving ? .6 : 1 }} disabled={saving}>{saving ? "Ukládám…" : "Uložit záznam"}</button>
          </div>
        </div>
      )}
      {error && <div style={{ color: "#ffb4b4", marginTop: "10px" }}>{error}</div>}
      {success && <div style={{ color: "lightgreen", marginTop: "10px" }}>{success}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = { margin: "6px 0 12px", padding: "11px 14px", width: "100%", border: "1px solid #ddd", borderRadius: "10px", fontSize: "1rem", color: "#333", backgroundColor: "white", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", outline: "none", boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { padding: "12px 20px", background: "rgba(255,255,255,0.34)", color: "white", fontWeight: 600, border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.22)", transition: "all 0.3s" };
