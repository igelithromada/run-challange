"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDoc
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
  imageUrls?: string[];
  teamId?: string;
  timestamp?: { seconds: number };
};

export default function MyRunsPage() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
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

  useEffect(() => {
    runs.forEach((run) => {
      if (run.uid && !userAvatars[run.uid]) {
        getDoc(doc(db, "users", run.uid)).then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserAvatars((prev) => ({
              ...prev,
              [run.uid!]: {
                avatarUrl: data.avatarUrl || "",
                nickname: data.nickname || "",
              },
            }));
          }
        });
      }
    });
  }, [runs, userAvatars]);

  const formatTime = (minutes: number) => {
    const totalSeconds = Math.round(minutes * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const handleShowImages = (images: string[], fallback: string) => {
    let urls: string[] = [];

    if (Array.isArray(images) && images.length > 0) {
      urls = images;
    } else if (typeof fallback === "string" && fallback !== "") {
      urls = [fallback];
    }

    if (urls.length > 0) {
      setShowImages(urls);
      setCurrentImgIndex(0);
    }
  };

  const handleNext = () => {
    if (showImages) {
      setCurrentImgIndex((currentImgIndex + 1) % showImages.length);
    }
  };

  const handlePrev = () => {
    if (showImages) {
      setCurrentImgIndex((currentImgIndex - 1 + showImages.length) % showImages.length);
    }
  };
  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={async (item) => {
        setMenuVisible(false);
        if (item === "logout") await signOut(auth);
        router.push(item === "myrun" ? "/myruns" : "/" + item);
      }} />

      <div className="container">
        <h1 className="centered-title">Moje aktivity</h1>

        <div className="tile-group">
          <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}>🏃 Běh</button>
          <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}>🚶 Chůze</button>
        </div>
<div className="tile-group" style={{ marginBottom: "1rem", marginTop: "1rem" }}>
  <div className="tile">📏 Celková vzdálenost: {totalKm.toFixed(2)} km</div>
  <div className="tile">⏱️ Celkový čas: {formatTime(totalMin)}</div>
  <div className="tile">⚖️ Průměrné tempo: {formatTime(avgTempo)} /km</div>
</div>
        <h2 className="centered-title">Moje záznamy</h2>
        <div className="list-container" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {runs
            .filter(run => (run.type || "běh") === selectedType)
            .map(run => {
              const user = userAvatars[run.uid || ""] || {};
              const nickname = user.nickname || run.nickname || run.email?.split("@")[0] || "Anonym";
              const avatarLetter = nickname.charAt(0).toUpperCase();
              const avatar = user.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                : avatarLetter;
              const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
              const pos = Math.min(100, Math.max(0, ((range.max - run.tempo) / (range.max - range.min)) * 100));
              const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleString("cs-CZ", {
                hour: "2-digit", minute: "2-digit", year: "numeric", month: "numeric", day: "numeric"
              });

              return (
                <div key={run.id} className="tile list-tile"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "0.5rem",
                    position: "relative", margin: "6px 0", padding: "6px 8px"
                  }}>
                  <div className="avatar" style={{ marginRight: "0.1rem" }}>{avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div>
                      <span style={{ fontWeight: "bold", color: "white" }}>{nickname}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                      <div>{run.km} km, {formatTime(run.minuty)}</div>
                      <div style={{
                        background: "rgba(0,0,0,0.0)", padding: "0.1rem 0.6rem",
                        borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center"
                      }}>
                        <div style={{ fontSize: "1rem", marginBottom: "0.1px" }}>{formatTime(run.tempo)} /km</div>
                        <div style={{
                          height: "5px", width: "70px",
                          background: "linear-gradient(90deg, red, yellow, green)",
                          borderRadius: "3px", position: "relative"
                        }}>
                          <div style={{
                            position: "absolute", top: "-4px", left: `${pos}%`,
                            width: "10px", height: "10px", background: "white",
                            border: "2px solid #333", borderRadius: "50%",
                            transform: "translateX(-50%)"
                          }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-end",
                    position: "absolute", right: "0.8rem", top: "0.4rem", gap: "0.3rem"
                  }}>
                    <small style={{ whiteSpace: "nowrap" }}>{dateStr}</small>
                    {(run.imageUrls?.length || run.imageUrl) && (
                      <div onClick={() => handleShowImages(run.imageUrls ?? [], run.imageUrl ?? "")} style={{ cursor: "pointer" }}>
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

        {showImages && (
          <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
          }}>
            <div style={{ position: "relative", textAlign: "center" }}>
              <img src={showImages[currentImgIndex]} alt="náhled" style={{ maxWidth: "90%", maxHeight: "80%", borderRadius: "10px" }} />
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
                  <button onClick={handlePrev} style={{
                    background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer"
                  }}>❮</button>
                  <button onClick={handleNext} style={{
                    background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer"
                  }}>❯</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

