"use client";
import React, { useEffect, useState } from "react";
import { db, storage } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";

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

type Props = {
  userId: string;
};

export default function UserRecordsAdmin({ userId }: Props) {
  const [runs, setRuns] = useState<RunData[]>([]);
  const [userInfo, setUserInfo] = useState({ nickname: "", avatarUrl: "", email: "" });
  const [teams, setTeams] = useState<{ id: string; name?: string }[]>([]);
  const [showImageUrl, setShowImageUrl] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "runs"), where("uid", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((doc): RunData => ({ id: doc.id, ...doc.data() }));
      const sorted = items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setRuns(sorted);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const fetchUser = async () => {
      const snapshot = await getDoc(doc(db, "users", userId));
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
  }, [userId]);

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

  const handleDeleteRun = async (run: RunData) => {
    if (!confirm("Opravdu smazat tento záznam včetně fotek?")) return;
    await deleteDoc(doc(db, "runs", run.id));
    if (run.imageUrls?.length) {
      for (const url of run.imageUrls) {
        const match = url.match(/\/([^/?#]+)\.(jpg|jpeg|png|webp)/i);
        if (match) {
          const fileName = match[1];
          await deleteObject(ref(storage, `images/${fileName}`));
        }
      }
    }
  };

  return (
    <div className="list-container" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {runs.map((run) => {
        const teamName = run.teamId ? teams.find(t => t.id === run.teamId)?.name || "?" : null;
        const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleDateString("cs-CZ");

        return (
          <div key={run.id} className="tile" style={{ padding: "10px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px", color: "white" }}>
              {dateStr} – {run.km} km, {formatTime(run.minuty)} ({formatTime(run.tempo)})
            </div>
            {run.imageUrls?.length > 0 && (
              <div onClick={() => { setCurrentImageIndex(0); setShowImageUrl(run.imageUrls!); }} style={{ cursor: "pointer" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
            <button onClick={() => handleDeleteRun(run)} style={{ marginTop: "4px", backgroundColor: "red", color: "white", border: "none", padding: "6px", borderRadius: "4px" }}>
              Smazat záznam
            </button>
          </div>
        );
      })}

      {showImageUrl && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.8)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            {showImageUrl.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                style={{
                  background: currentImageIndex === i ? "white" : "#666",
                  borderRadius: "50%",
                  width: "10px", height: "10px", border: "none"
                }}
              />
            ))}
          </div>
          <img
            src={showImageUrl[currentImageIndex]}
            style={{
              maxWidth: "90vw", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px", marginBottom: "1rem"
            }}
          />
          <div style={{ display: "flex", gap: "2rem" }}>
            {showImageUrl.length > 1 && (
              <button onClick={() => setCurrentImageIndex((currentImageIndex - 1 + showImageUrl.length) % showImageUrl.length)} style={{ fontSize: "2rem", color: "white", background: "transparent", border: "none" }}>
                ❮
              </button>
            )}
            <button onClick={() => setShowImageUrl(null)} style={{ background: "white", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}>
              Zavřít
            </button>
            {showImageUrl.length > 1 && (
              <button onClick={() => setCurrentImageIndex((currentImageIndex + 1) % showImageUrl.length)} style={{ fontSize: "2rem", color: "white", background: "transparent", border: "none" }}>
                ❯
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
