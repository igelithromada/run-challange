"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { RunData, UserData, TeamData } from "../types";

export default function MyRunsPage() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [users, setUsers] = useState<Record<string, UserData>>({});
  const [teams, setTeams] = useState<TeamData[]>([]);
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
          .map(doc => ({ id: doc.id, ...doc.data() } as RunData))
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

    // Načti všechny uživatele
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all: Record<string, UserData> = {};
      snap.forEach((doc) => {
        const data = doc.data() as UserData;
        all[data.id] = data;
      });
      setUsers(all);
    });

    // Načti všechny týmy
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TeamData)));
    });

    return () => {
      unsubUsers();
      unsubTeams();
    };
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
  const totalMin = filteredRuns.reduce((sum, run) => sum + (parseFloat(run.minuty) || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun = filteredRuns.reduce<RunData | null>((max, run) => (run.km > (max?.km || 0) ? run : max), null);
  const fastestRun = filteredRuns.reduce<RunData | null>((min, run) =>
    (parseFloat(run.tempo) < parseFloat(min?.tempo || "100") ? run : min), null
  );

  const handleDelete = async (id: string) => await deleteDoc(doc(db, "runs", id));

  const handleEdit = (run: RunData) => {
    setEditingId(run.id);
    setKm(run.km.toString());
    setMinuty(run.minuty);
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
      minuty: minuty,
      tempo: tempo.toString(),
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
    } else router.push("/" + item);
  };

  const showPhotoIcon = (run: RunData) => {
    const hasSingle = typeof run.imageUrl === "string" && run.imageUrl !== "";
    const hasMultiple = Array.isArray(run.imageUrls) && run.imageUrls.length > 0;
    return hasSingle || hasMultiple;
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
            🏆 Nejdelší {selectedType}: {longestRun.km} km za {formatTime(parseFloat(longestRun.minuty))} ({formatTime(parseFloat(longestRun.tempo))} /km)
          </div>
        )}
        {fastestRun && (
          <div className="tile">
            ⚡ Nejrychlejší {selectedType}: {fastestRun.km} km za {formatTime(parseFloat(fastestRun.minuty))} ({formatTime(parseFloat(fastestRun.tempo))} /km)
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
                <div className="avatar" style={{ marginRight: "0.1rem" }}>
                  {userAvatars[run.uid]?.avatarUrl ? (
                    <img src={userAvatars[run.uid].avatarUrl} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                  ) : (
                    (userAvatars[run.uid]?.nickname || run.nickname || run.email?.split("@")[0] || "?").charAt(0).toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: "bold", color: "white" }}>
                      {userAvatars[run.uid]?.nickname || run.nickname || run.email?.split("@")[0] || "Anonym"}
                    </span>
                    {run.teamId && teams.find(t => t.id === run.teamId)?.name && (
                      <span style={{ marginLeft: "10px", fontWeight: "bold", color: "white" }}>
                        ({teams.find(t => t.id === run.teamId)?.name})
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <div>{run.km} km, {formatTime(parseFloat(run.minuty))}</div>
                    <div style={{
                      background: "rgba(0,0,0,0.0)",
                      padding: "0.1rem 0.6rem",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center"
                    }}>
                      <div style={{ fontSize: "1rem", marginBottom: "0.1px" }}>
                        {formatTime(run.tempo)} /km
                      </div>
                      <div style={{
                        height: "5px", width: "70px",
                        background: "linear-gradient(90deg, red, yellow, green)",
                        borderRadius: "3px", position: "relative"
                      }}>
                        <div style={{
                          position: "absolute",
                          top: "-4px", left: `${
                            Math.min(100, Math.max(0, ((selectedType === "chůze" ? 20 : 8 - parseFloat(run.tempo)) / ((selectedType === "chůze" ? 20 : 8) - (selectedType === "chůze" ? 8 : 3))) * 100))
                          }%`,
                          width: "10px", height: "10px",
                          background: "white", border: "2px solid #333",
                          borderRadius: "50%", transform: "translateX(-50%)"
                        }} />
                      </div>
                    </div>
                  </div>
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
                  <small style={{ whiteSpace: "nowrap" }}>
                    {new Date(run.timestamp?.seconds * 1000).toLocaleString("cs-CZ")}
                  </small>
                  {showPhotoIcon(run) && (
                    <div onClick={() => setShowImageUrl(run.imageUrl ?? null)} style={{ cursor: "pointer" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="none" stroke="white" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                    <div style={{ cursor: "pointer" }} onClick={() => handleDelete(run.id)}>🗑️</div>
                    <div style={{ cursor: "pointer" }} onClick={() => handleEdit(run)}>✏️</div>
                  </div>
                </div>
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
