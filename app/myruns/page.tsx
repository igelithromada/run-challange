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
  getDownloadURL,
} from "firebase/storage";
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
      const unsubRuns = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((doc) => {
              const data = doc.data() as Omit<RunData, "id">;
              return { ...data, id: doc.id };
            })
            .sort(
              (a, b) =>
                (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
            );
          setRuns(items);
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setError("Chyba při načítání dat.");
          setLoading(false);
        }
      );

      return () => unsubRuns();
    });

    return () => unsubAuth();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu chceš smazat tento záznam?")) return;
    await deleteDoc(doc(db, "runs", id));
  };

  const handleEdit = (run: RunData) => {
    setEditingId(run.id);
    setKm(run.km?.toString() || "");
    setMinuty(run.minuty?.toString() || "");
  };

  const handleSave = async () => {
    if (!editingId) return;
    const refDoc = doc(db, "runs", editingId);
    const updateData: any = {
      km: parseFloat(km),
      minuty: parseFloat(minuty),
    };
    if (file) {
      const fileRef = ref(storage, `runs/${editingId}/${file.name}`);
      const snap = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snap.ref);
      updateData.imageUrl = url;
    }
    await updateDoc(refDoc, updateData);
    setEditingId(null);
    setKm("");
    setMinuty("");
    setFile(null);
  };

  const filteredRuns = runs.filter((run) => {
    if (run.type !== selectedType) return false;
    const date = new Date((run.timestamp?.seconds || 0) * 1000);
    if (dateFrom && date < new Date(dateFrom)) return false;
    if (dateTo && date > new Date(dateTo)) return false;
    return true;
  });

  const formatTime = (minutes?: number | string) => {
    const totalSeconds = Math.round(parseFloat(minutes as string) * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={(item) => {
        setMenuVisible(false);
        if (item === "logout") signOut(auth);
        else if (item === "statistics") router.push("/statistics");
      }} />

      <div className="container">
        <h1 className="centered-title">Moje aktivity</h1>

        <div className="tile-group">
          <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}>🏃 Běh</button>
          <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}>🚶 Chůze</button>
        </div>

        <div className="filter-row">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {loading ? <p>Načítání...</p> : error ? <p>{error}</p> : (
          filteredRuns.map((run) => {
            const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleDateString("cs-CZ");

            return (
              <div key={run.id} className="tile list-tile">
                {editingId === run.id ? (
                  <div>
                    <input value={km} onChange={(e) => setKm(e.target.value)} placeholder="Km" />
                    <input value={minuty} onChange={(e) => setMinuty(e.target.value)} placeholder="Minuty" />
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button onClick={handleSave}>💾 Uložit</button>
                  </div>
                ) : (
                  <div>
                    <strong>{run.km} km, {formatTime(run.minuty)}</strong>
                    <div>{dateStr}</div>
                    {run.imageUrl && (
                      <img src={run.imageUrl} alt="náhled" onClick={() => setShowImageUrl(run.imageUrl!)} style={{ maxWidth: 120, cursor: "pointer", marginTop: 6 }} />
                    )}
                    <button onClick={() => handleEdit(run)}>✏️</button>
                    <button onClick={() => handleDelete(run.id)}>🗑️</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000a", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div>
            <img src={showImageUrl} alt="náhled" style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: "10px" }} />
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button onClick={() => setShowImageUrl(null)} style={{ padding: "0.5rem 1rem", borderRadius: "10px", background: "white", fontWeight: "bold" }}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
