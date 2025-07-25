"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
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
  const [sekundy, setSekundy] = useState("0");
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

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all: Record<string, UserData> = {};
      snap.forEach((doc) => {
        const data = doc.data() as UserData;
        all[doc.id] = { ...data, id: doc.id };
      });
      setUsers(all);
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TeamData)));
    });

    return () => {
      unsubUsers();
      unsubTeams();
    };
  }, [router]);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else {
      router.push("/" + item);
    }
  };

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
    setSekundy(((parseFloat(run.minuty) % 1) * 60).toFixed(0));
    setFile(null);
  };

  const handleUpdate = async (id: string) => {
    let imageUrl = null;
    if (file) {
      const imageRef = ref(storage, `runs/${id}/${file.name}`);
      await uploadBytes(imageRef, file);
      imageUrl = await getDownloadURL(imageRef);
    }
    const totalMin = parseFloat(minuty) + parseFloat(sekundy) / 60;
    const tempo = totalMin / parseFloat(km);
    await updateDoc(doc(db, "runs", id), {
      km: parseFloat(km),
      minuty: totalMin.toString(),
      tempo: tempo.toFixed(2),
      ...(imageUrl && { imageUrl })
    });
    setEditingId(null);
    setFile(null);
  };
  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Moje aktivity</h1>

        {/* Přepínač typu */}
        <div className="tile-group">
          <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}>🏃 Běh</button>
          <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}>🚶 Chůze</button>
        </div>

        {/* Filtrování dle data */}
        <div className="tile" style={{ textAlign: "center" }}>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ marginLeft: "1rem" }} />
        </div>

        {/* Souhrnné statistiky */}
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

        {/* Seznam záznamů */}
        <h2 className="centered-title">Moje záznamy</h2>
        <div className="list-container" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {/* sem přijde map přes záznamy, který už máš z předchozí verze – nevkládám znovu celý kvůli délce */}
          {/* ... */}
        </div>
      </div>

      {/* Náhled fotky */}
      {showImageUrl && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
        }}>
          <div style={{ textAlign: "center" }}>
            <img
              src={showImageUrl}
              alt="náhled"
              style={{ maxHeight: "80vh", maxWidth: "90vw", borderRadius: "10px" }}
            />
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "1rem" }}>
              <button
                onClick={() => setShowImageUrl(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "5px",
                  background: "white",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Zavřít
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm("Opravdu chceš smazat fotku?")) return;
                  const run = runs.find(r =>
                    r.imageUrl === showImageUrl || r.imageUrls?.[0] === showImageUrl
                  );
                  if (!run) return;

                  await updateDoc(doc(db, "runs", run.id), {
                    imageUrl: null,
                    imageUrls: []
                  });
                  setShowImageUrl(null);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "5px",
                  background: "#f44336",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Smazat fotku
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
