"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import MyGalleryViewer from "../components/MyGalleryViewer";
import { fetchGalleryRunPage, type GalleryCursor } from "../lib/services/galleryRuns";
import { myGalleryPhotos, type GalleryPhoto } from "../lib/myGallery";
import { activityThumbnailUrl } from "../lib/imageUrl";
import type { RunData } from "../types";
function Photo({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const url = activityThumbnailUrl(photo.url);
  return (
    <button
      type="button"
      className="my-gallery-photo"
      onClick={onOpen}
      aria-label={`Otevřít fotografii z ${photo.date?.toLocaleDateString("cs-CZ") || "aktivity"}`}
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="my-gallery-placeholder">
          <Camera size={24} />
          Otevřít fotografii
        </span>
      )}
      <span className="my-gallery-photo-date">
        {photo.date?.toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "numeric",
        }) || "Bez data"}
      </span>
    </button>
  );
}
export default function GalleryPage() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [uid, setUid] = useState("");

  useEffect(() => onAuthStateChanged(auth, user => {
    setUid(user?.uid || "");
    if (!user) router.push("/login");
  }), [router]);

  return <>
    <Navbar title="Moje galerie" onMenuClick={() => setMenu(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menu} onClose={() => setMenu(false)} />
    <main className="container my-gallery-page">
      {uid ? <GalleryContents key={uid} uid={uid} /> : <p role="status">Načítám tvoje fotografie…</p>}
    </main>
  </>;
}

function GalleryContents({ uid }: { uid: string }) {
  const router = useRouter();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [cursor, setCursor] = useState<GalleryCursor | null>({ mode: "dated" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef<number | null>(null);
  const positioned = useRef<HTMLDivElement>(null);
  const photos = useMemo(() => myGalleryPhotos(runs, uid), [runs, uid]);
  const index = photos.findIndex(photo => photo.key === active);
  const photo = photos[index];

  const loadPage = useCallback(async (from: GalleryCursor) => {
    const version = generation.current;
    if (inFlight.current !== null || auth.currentUser?.uid !== uid) return;
    inFlight.current = version;
    setLoading(true);
    setError("");
    try {
      const page = await fetchGalleryRunPage(uid, from);
      if (generation.current !== version || auth.currentUser?.uid !== uid) return;
      setRuns(previous => [...new Map([...previous, ...page.items].map(run => [run.id, run])).values()]);
      setCursor(page.next);
      return page;
    } catch {
      if (generation.current === version) setError("Galerii se nepodařilo načíst. Zkus to znovu.");
    } finally {
      if (inFlight.current === version) inFlight.current = null;
      if (generation.current === version) setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const version = ++generation.current;
    queueMicrotask(() => { if (generation.current === version) void loadPage({ mode: "dated" }); });
    return () => { generation.current++; inFlight.current = null; };
  }, [loadPage]);

  useEffect(() => {
    if (!cursor || loading || active || error) return;
    let previous = window.scrollY;
    const nearEnd = () => {
      const current = window.scrollY;
      const movingDown = current > previous;
      previous = current;
      if (movingDown && positioned.current && positioned.current.getBoundingClientRect().top <= window.innerHeight + 160) {
        void loadPage(cursor);
      }
    };
    window.addEventListener("scroll", nearEnd, { passive: true });
    return () => window.removeEventListener("scroll", nearEnd);
  }, [cursor, loading, active, error, loadPage]);

  async function move(direction: number) {
    const target = index + direction;
    if (photos[target]) setActive(photos[target].key);
    else if (direction > 0 && cursor) {
      let from: GalleryCursor | null = cursor;
      const version = generation.current;
      const existing = new Set(photos.map(photo => photo.key));
      while (from && generation.current === version) {
        const page = await loadPage(from);
        if (!page || generation.current !== version) return;
        const next = myGalleryPhotos(page.items, uid).find(photo => !existing.has(photo.key));
        if (next) {
          setActive(current => current === active ? next.key : current);
          return;
        }
        from = page.next;
      }
      setActive(current => current === active ? photos[0]?.key ?? null : current);
    }
    else if (!cursor && photos.length) setActive(photos[(target + photos.length) % photos.length].key);
  }

  return <>
    {photos.length > 0 && <>
      <p className="chart-hint">
        {cursor ? "Načtené fotografie" : "Fotografie"}: {photos.length} · Záznamy s fotografiemi: {new Set(photos.map(item => item.runId)).size}
      </p>
      <section className="my-gallery-grid" aria-label="Fotografie mých záznamů">
        {photos.map(item => <Photo key={item.key} photo={item} onOpen={() => setActive(item.key)} />)}
      </section>
    </>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">{photos.length ? "Načítám další záznamy…" : "Načítám tvoje fotografie…"}</p>}
    {!loading && !error && !photos.length && (cursor
      ? <p>V načtených záznamech nejsou žádné fotografie.</p>
      : <div className="tile my-gallery-empty">
          <Camera size={30} />
          <p>Zatím nemáš žádné fotografie.</p>
          <button type="button" className="tile-button" onClick={() => router.push("/myruns")}>Moje aktivity</button>
        </div>)}
    <div ref={positioned}>
      {cursor && <button type="button" className="tile-button" disabled={loading} onClick={() => void loadPage(cursor)}>
        {error ? "Zkusit znovu" : "Načíst další záznamy"}
      </button>}
    </div>
    {photo && <MyGalleryViewer photo={photo} onClose={() => setActive(null)} onMove={move}
      status={loading ? "Načítám další fotografie…" : error}
      onOpenRun={() => {
        setActive(null);
        router.push("/#run-" + encodeURIComponent(photo.runId));
      }}
    />}
  </>;
}
