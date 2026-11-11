"use client";
import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import Navbar from "./components/Navbar";
import { Footprints } from "lucide-react";
import Sidebar from "./components/Sidebar";
import RunForm from "./components/RunForm";
import ActivityCard from "./components/ActivityCard";
import LoadingSkeleton from "./components/LoadingSkeleton";
import RunWeatherRecommendation from "./components/RunWeatherRecommendation";
import ActivityTypeSelector from "./components/ActivityTypeSelector";
import { RunData } from "./types";
import { useSharedFirestoreQuery } from "./lib/useSharedFirestoreQuery";
import { latestRunsQuery, fetchOlderRuns } from "./lib/services/runs";
import { getUserAvatars, getUserProfile } from "./lib/services/users";
import { allTeamsQuery } from "./lib/services/teams";
import type { TeamData } from "./types";

export default function Page() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [olderRuns, setOlderRuns] = useState<RunData[]>([]);
  const [olderCursor, setOlderCursor] = useState<import("firebase/firestore").QueryDocumentSnapshot | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedType, setSelectedType] = useState<"běh" | "chůze">("běh");
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [userAvatars, setUserAvatars] = useState<{ [key: string]: { avatarUrl: string; nickname: string } }>({});
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (!active) return;
      if (!user) { router.push("/login"); return; }
      try {
        const cachedActivity = localStorage.getItem("dolni-lhota-default-activity-v1");
        if (active && (cachedActivity === "běh" || cachedActivity === "chůze")) setSelectedType(cachedActivity);
        const profile = await getUserProfile(user.uid);
        if (!active || !profile) return;
        const remoteActivity = profile.defaultActivity === "chůze" ? "chůze" : "běh";
        setSelectedType(remoteActivity);
        try { localStorage.setItem("dolni-lhota-default-activity-v1", remoteActivity); } catch {}
      } catch {}
    });
    return () => { active = false; unsubAuth(); };
  }, [router]);

  const runsQuery = useMemo(() => latestRunsQuery(30), []);
  const teamsQuery = useMemo(() => allTeamsQuery(), []);
  const runsState = useSharedFirestoreQuery<RunData>("runs:latest:30", runsQuery);
  const teamsState = useSharedFirestoreQuery<TeamData>("teams:all", teamsQuery);
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
      const next = await fetchOlderRuns(cursor, 20);
      const items = next.items;
      setOlderRuns(previous => [
        ...previous,
        ...items.filter(item => !previous.some(old => old.id === item.id) && !runs.some(current => current.id === item.id))
      ]);
      setOlderCursor(next.lastDocument || cursor);
      setHasMore(next.items.length === 20);
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
        const avatarMap = await getUserAvatars(userIds);
        if (cancelled) return;
        setUserAvatars((prev) => {
          const next = { ...prev };
          userIds.forEach(uid => {
            next[uid] = { ...(prev[uid] || { nickname: "" }), avatarUrl: avatarMap[uid] || "" };
          });
          return next;
        });
      } catch (error) {
        console.error("Nepodařilo se načíst profily uživatelů", error);
      }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, [runs]);

  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "logout") signOut(auth).then(() => router.push("/login"));
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "weather") router.push("/weather");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "participants") router.push("/participants");
    else if (item === "progress") router.push("/progress");
    else if (item === "trainer") router.push("/trainer");
    else if (item === "admin") router.push("/admin");
    else router.push("/");
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
        <h1 className="sr-only">Dolní Lhota v pohybu</h1>

        <RunWeatherRecommendation type={selectedType} />

        <ActivityTypeSelector value={selectedType} onChange={(value) => { setSelectedType(value); try { localStorage.setItem("dolni-lhota-default-activity-v1", value); } catch {} }} />

        <div className="run-form-wrap">
          <RunForm type={selectedType} />
        </div>

        <h2 className="centered-title">Poslední záznamy</h2>
        <div className="list-container">
          {runsState.loading ? <LoadingSkeleton count={3} /> : allRuns.filter((run) => (run.type || "běh") === selectedType).map(run => {
            const team = run.teamId ? teams.find(t => t.id === run.teamId) : null;
            const teamName = team?.name || (run.teamId ? "?" : null);

            const user = userAvatars[run.uid] || {};
            const nickname = user.nickname || run.nickname || "Anonym";
            const resolvedAvatarUrl = user.avatarUrl || run.avatarUrl || "";
            return (
              <ActivityCard
                key={run.id}
                run={run}
                nickname={nickname}
                avatarUrl={resolvedAvatarUrl}
                teamName={teamName}
                teamAvatarUrl={team?.avatarUrl || ""}
                activityType={selectedType}
                onUserClick={() => router.push(`/user/${run.uid}`)}
                onPhotosClick={handleShowImages}
              />
            );          })}
          {!runsState.loading && allRuns.filter((run) => (run.type || "běh") === selectedType).length === 0 && (
            <div className="activity-empty-state">
              <Footprints size={28} aria-hidden="true" />
              <strong>Zatím tu není žádný záznam</strong>
              <span>Buď první, kdo přidá svou aktivitu.</span>
            </div>
          )}
        </div>
        {hasMore && allRuns.length >= 30 && (
          <button className="activity-load-more" onClick={loadOlderRuns} disabled={loadingOlder}>
            {loadingOlder ? "Načítám starší záznamy…" : "Načíst starší záznamy"}
          </button>
        )}
      </div>

      {showImages && (
        <div className="activity-lightbox" role="dialog" aria-modal="true" aria-label="Galerie fotografií" onClick={() => setShowImages(null)}>
          <div className="activity-lightbox-top" onClick={e => e.stopPropagation()}>
            <span>{currentImgIndex + 1} / {showImages.length}</span>
            <button type="button" onClick={() => setShowImages(null)} aria-label="Zavřít galerii">×</button>
          </div>
          <img src={showImages[currentImgIndex]} alt={`Fotografie aktivity ${currentImgIndex + 1}`} onClick={e => e.stopPropagation()} />
          <div className="activity-lightbox-actions" onClick={e => e.stopPropagation()}>
            {showImages.length > 1 ? (
              <button type="button" onClick={handlePrev} aria-label="Předchozí fotografie">‹</button>
            ) : <span />}
            <button type="button" onClick={() => setShowImages(null)}>Zavřít</button>
            {showImages.length > 1 ? (
              <button type="button" onClick={handleNext} aria-label="Další fotografie">›</button>
            ) : <span />}
          </div>
          {showImages.length > 1 && (
            <div className="activity-lightbox-thumbs" onClick={e => e.stopPropagation()}>
              {showImages.map((url, index) => (
                <button key={url + index} type="button" className={index === currentImgIndex ? "active" : ""} onClick={() => setCurrentImgIndex(index)} aria-label={`Fotografie ${index + 1}`}>
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}








