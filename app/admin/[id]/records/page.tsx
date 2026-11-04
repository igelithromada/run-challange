"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { signOut } from "firebase/auth";
import useAdminGuard from "../../../lib/useAdminGuard";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";

type Run = {
  id: string;
  uid?: string;
  km?: number;
  minuty?: number;        // celkový čas v minutách
  tempo?: number;         // min/km
  type?: string;          // "běh" | "chůze"
  timestamp?: { seconds: number };
  imageUrls?: string[];
  imageUrl?: string;      // starší single fotka
};

export default function RecordsPage() {
  const adminAccess = useAdminGuard();
  const { id } = useParams() as { id: string };   // id uživatele
  const router = useRouter();

  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedType, setSelectedType] = useState<"běh" | "chůze">("běh");
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  // načtení záznamů uživatele
  useEffect(() => {
    if (adminAccess !== "allowed" || !id) return;
    const qRef = query(collection(db, "runs"), where("uid", "==", id));
    const unsub = onSnapshot(qRef, (snap) => {
      const items: Run[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setRuns(items);
    });
    return () => unsub();
  }, [adminAccess, id]);

  const formatMinutes = (minutes?: number) => {
    const totalSeconds = Math.round((minutes || 0) * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}′${s.toString().padStart(2, "0")}″`;
  };

  const handleDelete = async (runId: string) => {
    const ok = confirm("Opravdu smazat tento záznam?");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "runs", runId));
      // (Pokud bys chtěl mazat i fotky z Cloudinary, je potřeba serverová funkce — zatím mažeme jen dokument.)
    } catch (e) {
      alert("Smazání se nepodařilo. Zkus to prosím znovu.");
      console.error(e);
    }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    }
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "progress") router.push("/progress");
    else if (item === "weather") router.push("/weather");
    else if (item === "admin") router.push("/admin");
    else router.push("/");
  };

  if (adminAccess !== "allowed") {
    return <div className="container"><p>Ověřuji administrátorská oprávnění…</p></div>;
  }

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Záznamy uživatele</h1>

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

        <div className="list-container" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {runs
            .filter(r => (r.type || "běh") === selectedType)
            .map(run => {
              const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleString("cs-CZ", {
                year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
              });
              const imgs = (run.imageUrls && run.imageUrls.length > 0)
                ? run.imageUrls
                : (run.imageUrl ? [run.imageUrl] : []);

              return (
                <div key={run.id} className="tile list-tile" style={{ position: "relative", padding: "var(--list-card-padding)", margin: "var(--list-card-margin)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{dateStr}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div>{run.km} km</div>
                    <div>čas {formatMinutes(run.minuty)}</div>
                    <div>tempo {formatMinutes(run.tempo)}</div>
                  </div>

                  <div style={{ position: "absolute", right: 8, top: 8, display: "flex", gap: 10 }}>
                    {imgs.length > 0 && (
                      <button
                        onClick={() => setLightbox({ urls: imgs, index: 0 })}
                        title="Zobrazit fotky"
                        style={{ background: "transparent", border: "none", cursor: "pointer" }}
                      >
                        {/* ikona fotky */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(run.id)}
                      title="Smazat záznam"
                      style={{ background: "transparent", border: "none", cursor: "pointer" }}
                    >
                      {/* koš */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem"
          }}
        >
          <img
            src={lightbox.urls[lightbox.index]}
            alt="photo"
            style={{ maxWidth: "92vw", maxHeight: "76vh", objectFit: "contain", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.urls.length > 1 && (
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(s => s && ({ ...s, index: (s.index - 1 + s.urls.length) % s.urls.length })); }}
                style={{ background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}
              >❮</button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(s => s && ({ ...s, index: (s.index + 1) % s.urls.length })); }}
                style={{ background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}
              >❯</button>
            </div>
          )}
          <button
            onClick={() => setLightbox(null)}
            style={{ marginTop: 12, background: "white", color: "#000", border: "none", borderRadius: 8, padding: "0.5rem 1rem", fontWeight: 700 }}
          >
            Zavřít
          </button>
        </div>
      )}
    </>
  );
}
