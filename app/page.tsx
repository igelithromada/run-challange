"use client";
import PhotoViewer from "./components/PhotoViewer";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
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
import { latestRunsQuery, fetchOlderRuns, fetchRunById } from "./lib/services/runs";
import { showAppToast } from "./components/AppToast";
import { mergeActivityFeed, RECENT_ACTIVITY_LIMIT } from "./lib/runData";
import { recordActivityType } from "./lib/activity";
import { normalizeActivityType } from "./lib/validation";
import { getUserProfile } from "./lib/services/users";

export default function Page() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [targetFailed, setTargetFailed] = useState(false);
  const [targetAttempt, setTargetAttempt] = useState(0);
  const [notificationRunId, setNotificationRunId] = useState<string | null>(null);
  const [olderRuns, setOlderRuns] = useState<RunData[]>([]);
  const [olderCursor, setOlderCursor] = useState<import("firebase/firestore").QueryDocumentSnapshot | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedType, setSelectedType] = useState<import("./types").ActivityType>("běh");
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const router = useRouter();
  const owner = useRef<string | null>(null);
  const viewerGeneration = useRef(0);
  const selectionVersion = useRef(0);
  const olderRequest = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (!active) return;
      const nextOwner = user?.uid ?? null;
      if (nextOwner !== owner.current) {
        owner.current = nextOwner;
        viewerGeneration.current++;
        selectionVersion.current++;
        olderRequest.current = false;
        setOlderRuns([]);
        setOlderCursor(null);
        setHasMore(true);
        setLoadingOlder(false);
        setShowImages(null);
        setNotificationRunId(null);
      }
      if (!user) { router.push("/login"); return; }
      const version = selectionVersion.current;
      try {
        const cachedActivity = localStorage.getItem("dolni-lhota-default-activity-v1");
        if (active && (cachedActivity === "běh" || cachedActivity === "chůze" || cachedActivity === "dřepy" || cachedActivity === "kliky")) setSelectedType(cachedActivity);
        const profile = await getUserProfile(user.uid);
        if (!active || !profile || auth.currentUser?.uid !== user.uid || version !== selectionVersion.current || window.location.hash.startsWith("#run-")) return;
        const remoteActivity = normalizeActivityType(profile.defaultActivity);
        setSelectedType(remoteActivity);
        try { localStorage.setItem("dolni-lhota-default-activity-v1", remoteActivity); } catch {}
      } catch {}
    });
    return () => { active = false; viewerGeneration.current++; unsubAuth(); };
  }, [router]);

  useEffect(() => {
    let active = true;
    let version = 0;
    const openTarget = async () => {
      const user = auth.currentUser;
      const request = ++version;
      setTargetFailed(false);
      if (!user || !window.location.hash.startsWith("#run-")) return;
      try {
        const id = decodeURIComponent(window.location.hash.slice(5));
        const run = await fetchRunById(id);
        if (!active || request !== version || auth.currentUser?.uid !== user.uid) return;
        if (!run) { showAppToast("Tato aktivita už byla odstraněna.", "error"); return; }
        setOlderRuns(previous => [run, ...previous.filter(item => item.id !== run.id)]);
        setSelectedType(normalizeActivityType(recordActivityType(run)));
        setNotificationRunId(run.id);
      } catch {
        if (active && request === version) setTargetFailed(true);
      }
    };
    const unsubscribe = onAuthStateChanged(auth, () => { void openTarget(); });
    window.addEventListener("hashchange", openTarget);
    return () => { active = false; ++version; unsubscribe(); window.removeEventListener("hashchange", openTarget); };
  }, [targetAttempt]);

  useEffect(() => {
    if (!notificationRunId) return;
    const frame = requestAnimationFrame(() => document.getElementById(`run-${notificationRunId}`)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [notificationRunId]);

  const runsQuery = useMemo(() => latestRunsQuery(RECENT_ACTIVITY_LIMIT), []);
  const runsState = useSharedFirestoreQuery<RunData>(`runs:latest:${RECENT_ACTIVITY_LIMIT}`, runsQuery);
  const runs = runsState.data;
  const allRuns = useMemo(() => mergeActivityFeed(olderRuns, runs), [olderRuns, runs]);
  const canLoadMore = olderCursor ? hasMore : runs.length >= RECENT_ACTIVITY_LIMIT;

  const loadOlderRuns = async () => {
    const cursor = olderCursor || runsState.lastDocument;
    if (!cursor || olderRequest.current || !canLoadMore) return;
    const version = viewerGeneration.current;
    const viewer = auth.currentUser?.uid;
    if (!viewer) return;
    olderRequest.current = true;
    setLoadingOlder(true);
    try {
      const next = await fetchOlderRuns(cursor, 20);
      if (version !== viewerGeneration.current || auth.currentUser?.uid !== viewer) return;
      const items = next.items;
      setOlderRuns(previous => mergeActivityFeed(previous, items));
      setOlderCursor(next.lastDocument || cursor);
      setHasMore(next.items.length === 20);
    } catch {
      if (version === viewerGeneration.current) showAppToast("Starší záznamy se nepodařilo načíst.", "error");
    } finally {
      if (version === viewerGeneration.current) {
        olderRequest.current = false;
        setLoadingOlder(false);
      }
    }
  };

  const handleShowImages = (images: string[], fallback: string, startIndex = 0) => {
    let urls: string[] = [];

    if (Array.isArray(images) && images.length > 0) {
      urls = images;
    } else if (typeof fallback === "string" && fallback !== "") {
      urls = [fallback];
    }

    if (urls.length > 0) {
      setShowImages(urls);
      setCurrentImgIndex(Math.max(0, Math.min(startIndex, urls.length - 1)));
    }
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <div className="container">
        <h1 className="sr-only">Dolní Lhota v pohybu</h1>

        <RunWeatherRecommendation type={selectedType} />

        <section className="home-quick-add" aria-labelledby="home-add-heading">
          <div className="home-section-heading">
            <div>
              <h2 id="home-add-heading">Nová aktivita</h2>
            </div>
          </div>
          <ActivityTypeSelector value={selectedType} onChange={(value) => { selectionVersion.current++; setSelectedType(value); try { localStorage.setItem("dolni-lhota-default-activity-v1", value); } catch {} }} />

          <div className="run-form-wrap">
            <RunForm key={selectedType} type={selectedType} />
          </div>
        </section>

        <section className="home-activity-feed" aria-labelledby="home-feed-heading">
          <div className="home-section-heading home-feed-heading">
            <div>
              <h2 id="home-feed-heading">Poslední záznamy</h2>
            </div>
          </div>
        {targetFailed && <div role="alert"><p>Záznam se nepodařilo načíst.</p><button className="run-secondary-button" onClick={() => setTargetAttempt(value => value + 1)}>Zkusit znovu</button></div>}
        <div className="list-container">
          {runsState.loading ? <LoadingSkeleton count={3} /> : allRuns.map(run => {
            return (
              <ActivityCard
                key={run.id}
                run={run}
                activityType={recordActivityType(run)}
                onUserClick={() => router.push(`/user/${run.uid}`)}
                onPhotosClick={handleShowImages}
              />
            );          })}
          {!runsState.loading && allRuns.length === 0 && (
            <div className="activity-empty-state">
              <Footprints size={28} aria-hidden="true" />
              <strong>{runsState.error ? "Záznamy se nepodařilo načíst" : "Zatím tu není žádný záznam"}</strong>
              <span>{runsState.error ? "Zkontroluj připojení a obnov stránku." : "Buď první, kdo přidá svou aktivitu."}</span>
            </div>
          )}
        </div>
        {canLoadMore && (
          <button className="activity-load-more" onClick={loadOlderRuns} disabled={loadingOlder}>
            {loadingOlder ? "Načítám starší záznamy…" : "Načíst starší záznamy"}
          </button>
        )}
        </section>
      </div>

      {showImages && <PhotoViewer url={showImages[currentImgIndex]} onClose={()=>setShowImages(null)} onMove={direction=>setCurrentImgIndex(index=>(index+direction+showImages.length)%showImages.length)}/>}

    </>
  );
}








