"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import useThemeLoader from "../../lib/useThemeLoader";

type RunData = {
  id: string;
  timestamp?: { seconds: number };
  km?: number;
  minuty?: number;
  tempo?: number | string;
  type?: string;
  teamId?: string;
  imageUrls?: string[];
  imageUrl?: string;
};

export default function UserPage() {
  useThemeLoader();
  const id = useParams().id as string;
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedType, setSelectedType] = useState("běh");
  const [userInfo, setUserInfo] = useState({ nickname: "", avatarUrl: "", email: "" });
  const [teams, setTeams] = useState<{ id: string; name?: string }[]>([]);
  const [showImageUrl, setShowImageUrl] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "runs"), where("uid", "==", id));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sorted = items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setRuns(sorted as RunData[]);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const fetchUser = async () => {
      const snapshot = await getDoc(doc(db, "users", id));
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserInfo({
          nickname: data.nickname || "",
          avatarUrl: data.avatarUrl || "",
          email: data.email || "",
        });
      }
    };
    fetchUser();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const formatTime = (minutes?: number | string) => {
    const totalSeconds = Math.round(parseFloat(minutes as string) * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "logout") router.push("/login");
    else if (item === "myruns") window.location.href = "/myruns";
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else router.push("/");
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">
          {userInfo.nickname || userInfo.email?.split("@")[0] || "Uživatel"}
        </h1>

        <div className="tile-group">
          <button
            className={`tile-button ${selectedType === "běh" ? "active" : ""}`}
            onClick={() => setSelectedType("běh")}
          >
            🏃 Běh
          </button>
          <button
            className={`tile-button ${selectedType === "chůze" ? "active" : ""}`}
            onClick={() => setSelectedType("chůze")}
          >
            🚶 Chůze
          </button>
        </div>

        <div className="list-container" style={{ gap: "0", display: "flex", flexDirection: "column" }}>
          {runs
            .filter(run => (run.type || "běh") === selectedType)
            .map(run => {
              const teamName = run.teamId ? teams.find(t => t.id === run.teamId)?.name || "?" : null;
              const avatarLetter = (userInfo.nickname || userInfo.email?.charAt(0) || "?").toUpperCase();
              const avatar = userInfo.avatarUrl
                ? <img src={userInfo.avatarUrl} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                : avatarLetter;

              const pos = (() => {
                const tempo = parseFloat(run.tempo as string);
                const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
                return Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
              })();

              const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleString("cs-CZ", {
                hour: "2-digit", minute: "2-digit", year: "numeric", month: "numeric", day: "numeric"
              });

              return (
                <div key={run.id} className="tile list-tile" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", position: "relative", margin: "6px 0", padding: "6px 8px" }}>
                  <div className="avatar" style={{ marginRight: "0.1rem" }}>{avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div>
                      <span style={{ fontWeight: "bold", color: "white" }}>
                        {userInfo.nickname || userInfo.email?.split("@")[0] || "Anonym"}
                      </span>
                      {teamName && (
                        <span style={{ marginLeft: "10px", fontWeight: "bold", color: "white" }}>
                          ({teamName})
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                      <div>{run.km} km, {formatTime(run.minuty)}</div>
                      <div style={{ background: "rgba(0,0,0,0.0)", padding: "0.1rem 0.6rem", borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: "1rem", marginBottom: "0.1px", color: "white", fontWeight: "bold" }}>
                          {formatTime(run.tempo)} /km
                        </div>
                        <div style={{ height: "5px", width: "70px", background: "linear-gradient(90deg, red, yellow, green)", borderRadius: "3px", position: "relative" }}>
                          <div style={{ position: "absolute", top: "-4px", left: `${pos}%`, width: "10px", height: "10px", background: "white", border: "2px solid #333", borderRadius: "50%", transform: "translateX(-50%)" }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", position: "absolute", right: "0.8rem", top: "0.4rem", gap: "0.3rem" }}>
                    <small>{dateStr}</small>
                    {(run.imageUrls?.length || run.imageUrl) && (
                      <div onClick={() => { setCurrentImageIndex(0); setShowImageUrl(run.imageUrls || [run.imageUrl!]); }} style={{ cursor: "pointer" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
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
      </div>

      {showImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div style={{ textAlign: "center" }}>
            <img src={showImageUrl[currentImageIndex]} alt="náhled" style={{ maxWidth: "90%", maxHeight: "80%", borderRadius: "10px" }} />
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "1rem" }}>
              <button disabled={currentImageIndex === 0} onClick={() => setCurrentImageIndex(currentImageIndex - 1)} style={{ padding: "0.4rem 1rem", fontSize: "16px", fontWeight: "bold", borderRadius: "8px", cursor: "pointer" }}>
                ◀
              </button>
              <button onClick={() => setShowImageUrl(null)} style={{ padding: "0.4rem 1.4rem", background: "white", color: "black", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}>
                Zavřít
              </button>
              <button disabled={currentImageIndex >= showImageUrl.length - 1} onClick={() => setCurrentImageIndex(currentImageIndex + 1)} style={{ padding: "0.4rem 1rem", fontSize: "16px", fontWeight: "bold", borderRadius: "8px", cursor: "pointer" }}>
                ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
