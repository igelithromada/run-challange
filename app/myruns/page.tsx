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

export default function MyRunsPage() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
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
          };
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
  const longestRun = filteredRuns.reduce<any | null>(
    (max, run) => (!max || run.km > max.km ? run : max), null
  );

  const fastestRun = filteredRuns.reduce<any | null>(
    (min, run) => (!min || run.tempo < min.tempo ? run : min), null
  );

  const handleDelete = async (id: string) => await deleteDoc(doc(db, "runs", id));

  const handleEdit = (run: any) => {
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

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else router.push("/" + item);
  };

  const handleShowImages = (images: string[], fallback: string) => {
    let urls: string[] = [];
    if (Array.isArray(images) && images.length > 0) urls = images;
    else if (typeof fallback === "string" && fallback !== "") urls = [fallback];
    if (urls.length > 0) {
      setShowImages(urls);
      setCurrentImgIndex(0);
    }
  };

  const handleNext = () => {
    if (showImages) setCurrentImgIndex((currentImgIndex + 1) % showImages.length);
  };

  const handlePrev = () => {
    if (showImages) setCurrentImgIndex((currentImgIndex - 1 + showImages.length) % showImages.length);
  };
  return (<>
    <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

    <div className="container">
      <h1 className="centered-title">Moje aktivity</h1>

      <div className="tile">
        <label>Typ:</label>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          <option value="běh">Běh</option>
          <option value="chůze">Chůze</option>
        </select>
        <label>Od:</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label>Do:</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="tile">📏 Celkem: {totalKm.toFixed(2)} km</div>
      <div className="tile">⏱️ Čas: {totalHours.toFixed(2)} h</div>
      <div className="tile">⚖️ Průměrné tempo: {formatTime(avgTempo)}</div>
      {fastestRun && (
        <div className="tile">
          ⚡ Nejrychlejší {selectedType}: {fastestRun.km} km za {formatTime(fastestRun.minuty)} ({formatTime(fastestRun.tempo)} /km)
        </div>
      )}
      {longestRun && (
        <div className="tile">
          🏆 Nejdelší {selectedType}: {longestRun.km} km za {formatTime(longestRun.minuty)} ({formatTime(longestRun.tempo)} /km)
        </div>
      )}

      {/* Zde následuje zobrazení jednotlivých záznamů stejně jako na hlavní stránce */}
      {/* ... */}
    </div>

    {showImages && (
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
      }}>
        <div style={{ position: "relative", textAlign: "center" }}>
          <img src={showImages[currentImgIndex]} alt="náhled" style={{
            maxWidth: "90%", maxHeight: "80%", borderRadius: "10px"
          }} />
          <div style={{ marginTop: "1.2rem" }}>
            <button onClick={() => setShowImages(null)} style={{
              background: "white", color: "black", border: "none",
              borderRadius: "12px", padding: "0.6rem 1.4rem",
              fontWeight: "bold", fontSize: "16px", cursor: "pointer"
            }}>Zavřít</button>
          </div>
          {showImages.length > 1 && (
            <div style={{
              position: "absolute", top: "50%", width: "100%", display: "flex",
              justifyContent: "space-between", transform: "translateY(-50%)", padding: "0 1rem"
            }}>
              <button onClick={handlePrev} style={{ background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}>❮</button>
              <button onClick={handleNext} style={{ background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}>❯</button>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
