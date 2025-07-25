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
      tempo: tempo.toFixed(2),
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
          {/* Zde následuje mapování záznamů a případné formuláře – ta část zůstává nezměněná z tvého posledního dlouhého kódu */}
        </div>
      </div>
    </>
  );
}
