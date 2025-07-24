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
import { RunData } from "../types";

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
        const items = snap.docs
          .map((doc) => {
            const data = doc.data() as Omit<RunData, "id">;
            return { ...data, id: doc.id };
          })
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setRuns(items);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError("Chyba při načítání dat.");
        setLoading(false);
      });

      return () => unsubRuns();
    });

    return () => unsubAuth();
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

  const totalKm = filteredRuns.reduce((sum, run) => sum + Number(run.km || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + Number(run.minuty || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun: RunData | null = filteredRuns.reduce<RunData | null>((max, run) =>
    !max || run.km > max.km ? run : max, null);

  const fastestRun: RunData | null = filteredRuns.reduce<RunData | null>((min, run) =>
    !min || run.tempo < min.tempo ? run : min, null);

  const handleDelete = async (id: string) => {
    if (confirm("Opravdu chcete tento záznam smazat?")) {
      await deleteDoc(doc(db, "runs", id));
    }
  };

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
    const tempo = parseFloat(minuty) / parseFloat(km);
    await updateDoc(doc(db, "runs", id), {
      km: parseFloat(km),
      minuty: parseFloat(minuty),
      tempo: tempo,
      ...(imageUrl && { imageUrl })
    });
    setEditingId(null);
    setFile(null);
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else {
      router.push("/" + item);
    }
  };

  const renderTempoBar = (tempo: number) => {
    const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
    let pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
    return (
      <div style={{ marginTop: "4px" }}>
        <div style={{ fontSize: "0.9rem", marginBottom: "2px" }}>
          {formatTime(tempo)} /km
        </div>
        <div style={{
          height: "5px", width: "70px",
          background: "linear-gradient(90deg, red, yellow, green)",
          borderRadius: "3px", position: "relative"
        }}>
          <div style={{
            position: "absolute",
            top: "-4px",
            left: `${pos}%`,
            width: "10px",
            height: "10px",
            background: "white",
            border: "2px solid #333",
            borderRadius: "50%",
            transform: "translateX(-50%)"
          }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

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
          <div className="tile">
            🏆 Nejdelší {selectedType}: {longestRun.km} km za {formatTime(longestRun.minuty)} ({formatTime(longestRun.tempo)} /km)
          </div>
        )}
        {fastestRun && (
          <div className="tile">
            ⚡ Nejrychlejší {selectedType}: {fastestRun.km} km za {formatTime(fastestRun.minuty)} ({formatTime(fastestRun.tempo)} /km)
          </div>
        )}

        <h2 className="centered-title">Moje záznamy</h2>
        <div className="list-container" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {filteredRuns.map(run =>
            editingId === run.id ? (
              <div key={run.id} className="tile list-tile" style={{ textAlign: "center" }}>
                <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" />
                <input type="number" value={minuty} onChange={(e) => setMinuty(e.target.value)} placeholder="min" />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button onClick={() => handleUpdate(run.id)}>💾 Uložit</button>
              </div>
            ) : (
              <div key={run.id} className="tile list-tile"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  position: "relative",
                  margin: "6px 0",
                  padding: "6px 8px"
                }}>
                <div className="avatar">{(run.nickname || run.email)?.charAt(0).toUpperCase() || "?"}</div>
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: "bold", color: "white" }}>
                      {run.nickname || run.email?.split("@")[0]}
                    </span>
                  </div>
                  <div>{run.km} km, {formatTime(run.minuty)}</div>
                  {renderTempoBar(run.tempo)}
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  position: "absolute",
                  right: "0.8rem",
                  top: "0.4rem"
                }}>
                  <div onClick={() => handleDelete(run.id)} style={{ cursor: "pointer" }}>🗑️</div>
                  <div onClick={() => handleEdit(run)} style={{ cursor: "pointer" }}>✏️</div>
                  {run.imageUrl && (
                    <div onClick={() => setShowImageUrl(run.imageUrl)} style={{ cursor: "pointer" }}>📷</div>
                  )}
                </div>
                <small style={{ position: "absolute", right: "0.8rem", bottom: "0.4rem" }}>
                  {new Date(run.timestamp?.seconds * 1000).toLocaleString("cs-CZ")}
                </small>
              </div>
            )
          )}
        </div>

        {showImageUrl && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
          }}>
            <div style={{ position: "relative" }}>
              <img src={showImageUrl} alt="náhled" style={{ maxHeight: "90%", maxWidth: "90%", borderRadius: "10px" }} />
              <button onClick={() => setShowImageUrl(null)} style={{
                position: "absolute", top: "-10px", right: "-10px",
                background: "white", color: "black", border: "none",
                borderRadius: "50%", width: "30px", height: "30px",
                cursor: "pointer", fontWeight: "bold", fontSize: "16px"
              }}>×</button>
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
