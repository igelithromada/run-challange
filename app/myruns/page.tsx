"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, getDoc,
  deleteDoc, updateDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL
} from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { RunData, UserData } from "../types";

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
  const [userAvatars, setUserAvatars] = useState<{ [uid: string]: UserData }>({});
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const q = query(collection(db, "runs"), where("uid", "==", user.uid));
      const unsubRuns = onSnapshot(q, (snap) => {
        const items: RunData[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RunData))
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setRuns(items);
        setLoading(false);

        items.forEach((run) => {
          const userRef = doc(db, "users", run.uid);
          getDoc(userRef).then((snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserData;
              setUserAvatars((prev) => ({
                ...prev,
                [run.uid]: { ...data, id: run.uid }
              }));
            }
          });
        });
      }, (err) => {
        console.error(err);
        setError("Chyba při načítání dat.");
        setLoading(false);
      });

      return () => unsubRuns();
    });
  }, [router]);

  const formatTime = (minutes: number | string) => {
    const totalSeconds = Math.round(parseFloat(minutes.toString()) * 60);
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

  const totalKm = filteredRuns.reduce((sum, run) => sum + (typeof run.km === "number" ? run.km : 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + parseFloat(run.minuty || "0"), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun = filteredRuns.reduce<RunData | null>((max, run) =>
    run.km > (max?.km || 0) ? run : max, null);

  const fastestRun = filteredRuns.reduce<RunData | null>((min, run) =>
    parseFloat(run.tempo) < parseFloat(min?.tempo || "100") ? run : min, null);

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
          {filteredRuns.map(run => {
            const user = userAvatars[run.uid];

            return editingId === run.id ? (
              <div key={run.id} className="tile list-tile" style={{ textAlign: "center" }}>
                <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="km" />
                <input type="number" value={minuty} onChange={(e) => setMinuty(e.target.value)} placeholder="min" />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button onClick={() => handleUpdate(run.id)}>💾 Uložit</button>
              </div>
            ) : (
              <div key={run.id} className="tile list-tile" style={{ display: "flex", alignItems: "center", position: "relative", gap: "0.8rem", padding: "6px 8px" }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} className="avatar" />
                ) : (
                  <div className="avatar">{(user?.nickname || run.email)?.charAt(0).toUpperCase() || "?"}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div><b style={{ color: "white" }}>{user?.nickname || run.email?.split("@")[0]}</b></div>
                  <div>{run.km} km, {formatTime(run.minuty)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                  <small>{new Date(run.timestamp?.seconds * 1000).toLocaleString("cs-CZ")}</small>
                  {run.imageUrl && (
                    <svg onClick={() => setShowImageUrl(run.imageUrl ?? null)} xmlns="http://www.w3.org/2000/svg"
                      fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                      stroke="currentColor" className="w-6 h-6 cursor-pointer">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l.867-1.5A2 2 0 015.598 5h12.804a2 2 0 011.731 1l.867 1.5M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M3 8h18m-9 4a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
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
