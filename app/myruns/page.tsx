"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, getDoc,
  deleteDoc, updateDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
  const [userAvatars, setUserAvatars] = useState<{ [key: string]: { avatarUrl: string; nickname: string } }>({});
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const q = query(collection(db, "runs"), where("uid", "==", user.uid));
      const unsubRuns = onSnapshot(q, (snap) => {
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as RunData));
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

  useEffect(() => {
    runs.forEach((run) => {
      if (run.uid && !userAvatars[run.uid]) {
        getDoc(doc(db, "users", run.uid)).then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserAvatars((prev) => ({
              ...prev,
              [run.uid]: {
                avatarUrl: data.avatarUrl || "",
                nickname: data.nickname || "",
              },
            }));
          }
        });
      }
    });
  }, [runs]);

  const formatTime = (minutes: number) => {
    const totalSeconds = Math.round(minutes * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const filteredRuns = runs
    .filter((run) => (run.type || "běh") === selectedType)
    .filter((run) => {
      const date = new Date((run.timestamp?.seconds || 0) * 1000);
      if (dateFrom && new Date(dateFrom) > date) return false;
      if (dateTo && new Date(dateTo + "T23:59") < date) return false;
      return true;
    })
    .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  const totalKm = filteredRuns.reduce((sum, run) => sum + (run.km || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + (run.minuty || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun = filteredRuns.reduce((max, run) => (run.km > (max?.km || 0) ? run : max), null);
  const fastestRun = filteredRuns.reduce((min, run) => (run.tempo < (min?.tempo || Infinity) ? run : min), null);

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

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else {
      router.push("/" + item);
    }
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
          {filteredRuns.map((run) => {
            const user = userAvatars[run.uid] || {};
            const nickname = user.nickname || run.nickname || run.email?.split("@")[0] || "Anonym";
            const avatarLetter = nickname.charAt(0).toUpperCase();
            const avatar = user.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
              : avatarLetter;
            const dateStr = new Date(run.timestamp?.seconds * 1000).toLocaleString("cs-CZ");

            return (
              <div key={run.id} className="tile list-tile"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  position: "relative",
                  margin: "6px 0",
                  padding: "6px 8px"
                }}>
                <div className="avatar">{avatar}</div>
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: "bold", color: "white" }}>
                      {nickname}
                    </span>
                  </div>
                  <div>{run.km} km, {formatTime(run.minuty)}</div>
                  {renderTempoBar(run.tempo)}
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  position: "absolute",
                  right: "0.8rem",
                  top: "0.4rem",
                  gap: "0.3rem"
                }}>
                  <small>{dateStr}</small>
                  {run.imageUrl && (
                    <div onClick={() => setShowImageUrl(run.imageUrl)} style={{ cursor: "pointer" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="none" stroke="white" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
