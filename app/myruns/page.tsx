"use client";
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";

type Run = {
  id: string;
  km?: number;
  minuty?: number;
  tempo?: string;
  type?: string;
  timestamp?: {
    seconds: number;
    toDate?: () => Date;
  };
  imageUrl?: string;
};

export default function MyRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImageId, setShowImageId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [minuty, setMinuty] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setError("Nejste přihlášený.");
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "runs"),
        where("uid", "==", user.uid)
      );

      const unsubscribeRuns = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Run[];
        items.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        setRuns(items);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError("Chyba při načítání dat.");
        setLoading(false);
      });

      return () => unsubscribeRuns();
    });

    return () => unsubscribeAuth();
  }, []);

  const filteredRuns = runs.filter(run => {
    const typeMatch = (run.type || "běh") === selectedType;
    let dateMatch = true;

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0,0,0,0);
      const runDate = new Date((run.timestamp?.seconds || 0) * 1000);
      dateMatch = dateMatch && runDate >= fromDate;
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23,59,59,999);
      const runDate = new Date((run.timestamp?.seconds || 0) * 1000);
      dateMatch = dateMatch && runDate <= toDate;
    }

    return typeMatch && dateMatch;
  });

  const totalKm = filteredRuns.reduce((sum, run) => sum + (run.km || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + (run.minuty || 0), 0);
  const avgTempo = totalKm ? (totalMin / totalKm).toFixed(2) : 0;
  const totalHours = (totalMin / 60).toFixed(2);

  const longestRun = filteredRuns.reduce((max, run) => (run.km && run.km > (max?.km || 0) ? run : max), null);
  const fastestRun = filteredRuns.reduce((min, run) => (run.tempo && run.tempo < (min?.tempo || Infinity) ? run : min), null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "runs", id));
    } catch (err) {
      console.error("Chyba při mazání: ", err);
    }
  };

  const handleEdit = (run: Run) => {
    setEditingId(run.id);
    setKm(run.km?.toString() || "");
    setMinuty(run.minuty?.toString() || "");
    setFile(null);
  };

  const handleUpdate = async (id: string) => {
    try {
      let imageUrl = null;

      if (file) {
        const imageRef = ref(storage, `runs/${id}/${file.name}`);
        await uploadBytes(imageRef, file);
        imageUrl = await getDownloadURL(imageRef);
      }

      const tempo = (parseFloat(minuty) / parseFloat(km)).toFixed(2);
      await updateDoc(doc(db, "runs", id), {
        km: parseFloat(km),
        minuty: parseFloat(minuty),
        tempo: parseFloat(tempo),
        ...(imageUrl && { imageUrl })
      });
      setEditingId(null);
      setFile(null);
    } catch (err) {
      console.error("Chyba při ukládání: ", err);
    }
  };

  const renderRunItem = (run: Run, highlight = false) => (
    <li key={run.id} style={{ 
      marginBottom: "1rem", 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center",
      backgroundColor: highlight ? "#f9f9f9" : "transparent",
      padding: highlight ? "1rem" : "0",
      borderRadius: highlight ? "8px" : "0"
    }}>
      <div style={{ textAlign: "center" }}>
        🏃 {run.km} km, {run.minuty} min, {run.tempo} min/km <br />
        <small style={{ color: "#555" }}>
          {run.timestamp?.toDate?.()
            ? run.timestamp.toDate().toLocaleString("cs-CZ")
            : new Date(run.timestamp?.seconds ? run.timestamp.seconds * 1000 : 0).toLocaleString("cs-CZ")}
        </small>
      </div>
      <div style={{ marginLeft: "1rem" }}>
        {run.imageUrl && (
          showImageId === run.id ? (
            <>
              <img 
                src={run.imageUrl}
                alt="běh fotka"
                style={{ maxWidth: "100px", display: "block", margin: "5px auto" }}
              />
              <button onClick={() => setShowImageId(null)}>Zavřít</button>
            </>
          ) : (
            <span
              style={{ cursor: "pointer", marginLeft: "5px" }}
              onClick={() => setShowImageId(run.id)}
            >
              📷
            </span>
          )
        )}
        {editingId === run.id ? (
          <>
            <div>
              <input type="number" value={km} onChange={(e) => setKm(e.target.value)} style={{ width: "60px" }} />
              <input type="number" value={minuty} onChange={(e) => setMinuty(e.target.value)} style={{ width: "60px", marginLeft: "5px" }} />
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginLeft: "5px" }} />
            </div>
            <button onClick={() => handleUpdate(run.id)} style={{ marginTop: "5px" }}>💾 Uložit</button>
          </>
        ) : (
          <>
            <button onClick={() => handleEdit(run)} style={{ marginLeft: "5px" }}>✏️ Upravit</button>
            <button 
              onClick={() => handleDelete(run.id)}
              style={{ marginLeft: "5px", color: "red" }}
            >
              🗑 Smazat
            </button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Moje aktivity</h1>
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setSelectedType("běh")} style={{ backgroundColor: selectedType === "běh" ? "orange" : "white", border: "1px solid black", padding: "8px 16px", marginRight: "5px" }}>Běh</button>
        <button onClick={() => setSelectedType("chůze")} style={{ backgroundColor: selectedType === "chůze" ? "orange" : "white", border: "1px solid black", padding: "8px 16px" }}>Chůze</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div><div style={{ marginBottom: "5px" }}>Datum od</div><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "5px" }} /></div>
        <div><div style={{ marginBottom: "5px" }}>Datum do</div><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "5px" }} /></div>
      </div>
      <button onClick={() => router.push("/")} style={{ marginBottom: "1rem", padding: "0.5rem 1rem", backgroundColor: "#f0ad4e", border: "none", borderRadius: "5px", cursor: "pointer", color: "white" }}>← Zpět na hlavní stránku</button>
      {filteredRuns.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1rem", marginBottom: "2rem" }}>
          <div style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "8px", minWidth: "100px" }}>
            <div style={{ fontWeight: "bold" }}>Aktivit</div>
            <div>{filteredRuns.length}</div>
          </div>
          <div style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "8px", minWidth: "100px" }}>
            <div style={{ fontWeight: "bold" }}>Celkem</div>
            <div>{totalKm.toFixed(2)} km</div>
          </div>
          <div style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "8px", minWidth: "100px" }}>
            <div style={{ fontWeight: "bold" }}>Čas</div>
            <div>{totalHours} hod</div>
          </div>
          <div style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "8px", minWidth: "100px" }}>
            <div style={{ fontWeight: "bold" }}>Prům. tempo</div>
            <div>{avgTempo} min/km</div>
          </div>
        </div>
      )}
      {longestRun && (
        <>
          <hr style={{ margin: "2rem 0", borderTop: "1px dashed #ccc" }} />
          <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>🏆 Nejdelší aktivita:</div>
          <ul style={{ listStyle: "none", padding: 0 }}>{renderRunItem(longestRun, true)}</ul>
          <hr style={{ margin: "2rem 0", borderTop: "1px dashed #ccc" }} />
        </>
      )}
      {fastestRun && (
        <>
          <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>⚡ Nejrychlejší aktivita:</div>
          <ul style={{ listStyle: "none", padding: 0 }}>{renderRunItem(fastestRun, true)}</ul>
          <hr style={{ margin: "2rem 0", borderTop: "1px dashed #ccc" }} />
        </>
      )}
      {loading && <p>Načítám...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {filteredRuns.length === 0 && !loading && <p>Nemáte žádné záznamy pro tento výběr.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredRuns.map(run => renderRunItem(run))}
      </ul>
    </div>
  );
}
