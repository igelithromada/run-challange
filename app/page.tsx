"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  doc,
  getDocs,
  startAfter,
  documentId,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "./lib/firebase";
import Navbar from "./components/Navbar";
import { Footprints, PersonStanding } from "lucide-react";
import Sidebar from "./components/Sidebar";
import RunForm from "./components/RunForm";
import ActivityCard from "./components/ActivityCard";
import LoadingSkeleton from "./components/LoadingSkeleton";
import { cloudinaryImageUrl } from "./lib/imageUrl";
import RunWeatherRecommendation from "./components/RunWeatherRecommendation";
import { RunData } from "./types";
import { useSharedFirestoreQuery } from "./lib/useSharedFirestoreQuery";

export default function Page() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [olderRuns, setOlderRuns] = useState<RunData[]>([]);
  const [olderCursor, setOlderCursor] = useState<any>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedType, setSelectedType] = useState("běh");
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [userAvatars, setUserAvatars] = useState<{ [key: string]: { avatarUrl: string; nickname: string } }>({});
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!user) router.push("/login");
    });
    return () => unsubAuth();
  }, [router]);

  const runsQuery = useMemo(() => query(collection(db, "runs"), orderBy("timestamp", "desc"), limit(30)), []);
  const teamsQuery = useMemo(() => query(collection(db, "teams")), []);
  const runsState = useSharedFirestoreQuery<RunData>("runs:latest:30", runsQuery);
  const teamsState = useSharedFirestoreQuery<any>("teams:all", teamsQuery);
  const runs = runsState.data;
  const teams = teamsState.data;
  const allRuns = Array.from(new Map<string, RunData>([...runs, ...olderRuns].map(run => [run.id, run] as const)).values());

  useEffect(() => {
    if (!runsState.loading && runs.length < 30) setHasMore(false);
  }, [runsState.loading, runs.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ["/myruns", "/statistics", "/teams", "/weather"].forEach(path => router.prefetch(path));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [router]);

  const loadOlderRuns = async () => {
    const cursor = olderCursor || runsState.lastDocument;
    if (!cursor || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const next = await getDocs(query(collection(db, "runs"), orderBy("timestamp", "desc"), startAfter(cursor), limit(20)));
      const items = next.docs.map(item => ({ id: item.id, ...item.data() } as RunData));
      setOlderRuns(previous => [
        ...previous,
        ...items.filter(item => !previous.some(old => old.id === item.id) && !runs.some(current => current.id === item.id))
      ]);
      setOlderCursor(next.docs.length ? next.docs[next.docs.length - 1] : cursor);
      setHasMore(next.docs.length === 20);
    } catch (error) {
      console.error("Nepodařilo se načíst starší aktivity", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    const userIds = Array.from(new Set(runs.map((run) => run.uid).filter((uid): uid is string => !!uid && !userAvatars[uid])));
    if (userIds.length === 0) return;

    let cancelled = false;
    const loadUsers = async () => {
      try {
        // Firestore "in" dotaz načte profily dávkově místo jednoho požadavku pro každý záznam.
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += 30) chunks.push(userIds.slice(i, i + 30));
        const snapshots = await Promise.all(chunks.map((ids) =>
          getDocs(query(collection(db, "users"), where(documentId(), "in", ids)))
        ));
        if (cancelled) return;
        setUserAvatars((prev) => {
          const next = { ...prev };
          snapshots.forEach((snapshot) => snapshot.docs.forEach((userDoc) => {
            const data = userDoc.data();
            next[userDoc.id] = { avatarUrl: data.avatarUrl || "", nickname: data.nickname || "" };
          }));
          return next;
        });
      } catch (error) {
        console.error("Nepodařilo se načíst profily uživatelů", error);
      }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, [runs]);

  const formatTime = (minutes: string) => {
    const totalSeconds = Math.round(parseFloat(minutes) * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "logout") signOut(auth).then(() => router.push("/login"));
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "weather") router.push("/weather");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "progress") router.push("/progress");
    else if (item === "admin") router.push("/admin");
    else router.push("/");
  };

  const showPhotoIcon = (run: RunData) => {
    const hasSingle = typeof run.imageUrl === "string" && run.imageUrl !== "";
    const hasMultiple = Array.isArray(run.imageUrls) && run.imageUrls.length > 0;
    return hasSingle || hasMultiple;
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
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title"></h1>

        <RunWeatherRecommendation />

        <div className="tile-group" role="group" aria-label="Typ aktivity">
          <button className={`tile-button ${selectedType === "běh" ? "active" : ""}`} onClick={() => setSelectedType("běh")}><PersonStanding className="run-profile-icon" size={26} strokeWidth={2.6} aria-hidden="true" /> Běh</button>
          <button className={`tile-button ${selectedType === "chůze" ? "active" : ""}`} onClick={() => setSelectedType("chůze")}><Footprints size={25} strokeWidth={2.8} /> Chůze</button>
        </div>

        <div className="run-form-wrap">
          <RunForm type={selectedType} />
        </div>

        <h2 className="centered-title">Poslední záznamy</h2>
        <div className="list-container" style={{ gap: "0", display: "flex", flexDirection: "column" }}>
          {allRuns.filter((run) => (run.type || "běh") === selectedType).map(run => {
            const teamName = run.teamId ? teams.find(t => t.id === run.teamId)?.name || "?" : null;

            const user = userAvatars[run.uid] || {};
            const nickname = user.nickname || run.nickname || run.email?.split("@")[0] || "Anonym";
            const avatarLetter = nickname.charAt(0).toUpperCase();

            const avatar = user.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
              : avatarLetter;

            const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
            let pos = Math.min(100, Math.max(0, ((range.max - parseFloat(run.tempo)) / (range.max - range.min)) * 100));

            const dateStr = new Date(run.timestamp?.seconds * 1000).toLocaleString("cs-CZ", {
              hour: "2-digit", minute: "2-digit", year: "numeric", month: "numeric", day: "numeric"
            });

            return (
              <ActivityCard
                key={run.id}
                run={run}
                nickname={nickname}
                avatarUrl={user.avatarUrl}
                teamName={teamName}
                activityType={selectedType}
                onUserClick={() => router.push(`/user/${run.uid}`)}
                onPhotosClick={handleShowImages}
              />
            );          })}
        </div>
        {hasMore && allRuns.length >= 30 && (
          <button className="activity-load-more" onClick={loadOlderRuns} disabled={loadingOlder}>
            {loadingOlder ? "Načítám starší záznamy…" : "Načíst starší záznamy"}
          </button>
        )}
      </div>

      {showImages && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.9)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
      padding: "1rem",
      boxSizing: "border-box",
    }}
  >
    <div style={{ marginBottom: "0.5rem", textAlign: "center" }}>
      {showImages.map((_, idx) => (
        <span
          key={idx}
          style={{
            height: "10px",
            width: "10px",
            margin: "0 5px",
            backgroundColor: currentImgIndex === idx ? "white" : "gray",
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
      ))}
    </div>

    <div
      style={{
        maxWidth: "90vw",
        maxHeight: "70vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <img
        src={showImages[currentImgIndex]}
        alt="náhled"
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "70vh",
          objectFit: "contain",
          borderRadius: "10px",
        }}
      />
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1.5rem",
        width: "100%",
        maxWidth: "300px",
      }}
    >
      {showImages.length > 1 ? (
        <button
          onClick={handlePrev}
          style={{
            background: "transparent",
            color: "white",
            fontSize: "2rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          ❮
        </button>
      ) : (
        <div style={{ width: "2rem" }} />
      )}

      <button
        onClick={() => setShowImages(null)}
        style={{
          background: "white",
          color: "black",
          border: "none",
          borderRadius: "12px",
          padding: "0.6rem 1.4rem",
          fontWeight: "bold",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Zavřít
      </button>

      {showImages.length > 1 ? (
        <button
          onClick={handleNext}
          style={{
            background: "transparent",
            color: "white",
            fontSize: "2rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          ❯
        </button>
      ) : (
        <div style={{ width: "2rem" }} />
      )}
    </div>
  </div>
)}
    </>
  );
}








