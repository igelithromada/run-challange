"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc,
  deleteDoc, updateDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL
} from "firebase/storage";
import {
  onAuthStateChanged, signOut
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";

type RunData = {
  id: string;
  uid?: string;
  email?: string;
  nickname?: string;
  km: number;
  minuty: number;
  tempo: number;
  type?: string;
  imageUrl?: string;
  timestamp?: { seconds: number };
};

export default function MyRunsPage() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImageUrl, setShowImageUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [minuty, setMinuty] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const q = query(collection(db, "runs"), where("uid", "==", user.uid));
      const unsubRuns = onSnapshot(q, (snap) => {
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            km: Number(data.km) || 0,
            minuty: Number(data.minuty) || 0,
            tempo: Number(data.tempo) || 0
          } as RunData;
        }).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setRuns(items);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError("Chyba při načítání dat.");
        setLoading(false);
      });

      return () => unsubRuns();
    });
  }, [router]);

  const formatTime = (minutes: number) => {
    const totalSeconds = Math.round(minutes * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const filteredRuns = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = new Date((run.timestamp?.seconds || 0) * 1000);
    if (dateFrom && new Date(dateFrom) > date) return false;
    if (dateTo && new Date(dateTo + "T23:59") < date) return false;
    return true;
  });

  const totalKm = filteredRuns.reduce((sum, run) => sum + (run.km || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + (run.minuty || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun = filteredRuns.reduce<RunData | null>(
    (max, run) => (!max || run.km > max.km ? run : max), null
  );

  const fastestRun = filteredRuns.reduce<RunData | null>(
    (min, run) => (!min || run.tempo < min.tempo ? run : min), null
  );

  const handleDelete = async (id: string) => await deleteDoc(doc(db, "runs", id));
  const handleEdit = (run: RunData) => {
    setEditingId(run.id);
    setKm(run.km.toString());
    setMinuty(run.minuty.toString());
    setFile(null);
  };
  const handleUpdate = async (id: string) => {
    let imageUrl = null;
    if (file) {
      const imageRef = ref(storage, `runs/${id}/${file.name}`);
      await uploadBytes(imageRef, file);
      imageUrl = await getDownloadURL(imageRef);
    }
    const parsedKm = parseFloat(km);
    const parsedMinuty = parseFloat(minuty);
    const tempo = parsedKm ? parsedMinuty / parsedKm : 0;

    await updateDoc(doc(db, "runs", id), {
      km: parsedKm,
      minuty: parsedMinuty,
      tempo: tempo,
      ...(imageUrl && { imageUrl })
    });
    setEditingId(null);
    setFile(null);
  };

  const renderTempoBar = (tempo: number) => {
    const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
    let pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
    return (
      <div className="tempo-container">
        <div className="tempo-label">{formatTime(tempo)} /km</div>
        <div className="tempo-bar">
          <div className="tempo-pointer" style={{ left: `${pos}%` }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={(item) => {
        setMenuVisible(false);
        item === "logout" ? signOut(auth).then(() => router.push("/login")) : router.push("/" + item);
      }} />

      <div className="container">
        <h1 className="centered-title">Moje aktivity</h1>

        <div className="tile-group">
          <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}>🏃 Běh</button>
          <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}>🚶 Chůze</button>
        </div>

        <div className="tile" style={{ textAlign: "center" }}>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ marginLeft: "1rem" }} />
        </div>

        <div className="tile-group">
          <div className="tile">Počet aktivit<br />{filteredRuns.length}</div>
          <div className="tile">Celkem km<br />{totalKm.toFixed(2)}</div>
          <div className="tile">Čas<br />{totalHours.toFixed(2)} h</div>
          <div className="tile">Prům. tempo<br />{formatTime(avgTempo)}</div>
        </div>

        {longestRun && (
          <div className="tile">🏆 Nejdelší {selectedType}: {longestRun.km} km za {formatTime(longestRun.minuty)} ({formatTime(longestRun.tempo)} /km)</div>
        )}
        {fastestRun && (
          <div className="tile">⚡ Nejrychlejší {selectedType}: {fastestRun.km} km za {formatTime(fastestRun.minuty)} ({formatTime(fastestRun.tempo)} /km)</div>
        )}

        <h2 className="centered-title">Moje záznamy</h2>
        <div className="list-container">
          {filteredRuns.map(run =>
            editingId === run.id ? (
              <div key={run.id} className="tile list-tile edit-tile">
                <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" />
                <input type="number" value={minuty} onChange={(e) => setMinuty(e.target.value)} placeholder="min" />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button onClick={() => handleUpdate(run.id)}>💾 Uložit</button>
              </div>
            ) : (
              <div key={run.id} className="tile list-tile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                <div className="avatar">{(run.nickname || run.email)?.charAt(0).toUpperCase() || "?"}</div>
                <div style={{ flex: 1, marginLeft: "0.5rem" }}>
                  <div>
                    <span style={{ fontWeight: "bold", color: "white" }}>
                      {run.nickname || run.email?.split("@")[0]}
                    </span>
                  </div>
                  <div>{run.km} km, {formatTime(run.minuty)}</div>
                  {renderTempoBar(run.tempo)}
                </div>
                <div className="icons-column">
                  {run.imageUrl && (
                    <span className="icon" title="Zobrazit fotku" onClick={() => setShowImageUrl(run.imageUrl ?? null)}>📷</span>
                  )}
                  <span className="icon" title="Upravit" onClick={() => handleEdit(run)}>✏️</span>
                  <span className="icon" title="Smazat" onClick={() => handleDelete(run.id)}>🗑️</span>
                  <small>{new Date((run.timestamp?.seconds || 0) * 1000).toLocaleString("cs-CZ")}</small>
                </div>
              </div>
            )
          )}
        </div>

        {showImageUrl && (
          <div className="modal-backdrop">
            <div className="modal-image-wrapper">
              <img src={showImageUrl} alt="náhled" className="modal-image" />
              <button className="modal-close" onClick={() => setShowImageUrl(null)}>×</button>
            </div>
          </div>
        )}

        {loading && <p>Načítám...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && filteredRuns.length === 0 && <p>Nemáte žádné záznamy.</p>}
      </div>
    </>
  );
}
