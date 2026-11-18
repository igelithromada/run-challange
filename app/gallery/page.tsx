"use client";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import MyGalleryViewer from "../components/MyGalleryViewer";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { personalHistoryQuery } from "../lib/services/runs";
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
  const [menu, setMenu] = useState(false),
    [uid, setUid] = useState(""),
    [limit, setLimit] = useState(60),
    [active, setActive] = useState<string | null>(null);
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setActive(null);
        setUid(user?.uid || "");
        if (!user) router.push("/login");
      }),
    [router],
  );
  const query = useMemo(
    () => personalHistoryQuery(uid || "__no_user__"),
    [uid],
  );
  const state = useSharedFirestoreQuery<RunData>(
    `personal-history:v2:${uid || "none"}`,
    query,
  );
  const photos = useMemo(
    () => myGalleryPhotos(state.data, uid, "all", "", ""),
    [state.data, uid],
  );
  const index = photos.findIndex((photo) => photo.key === active),
    photo = photos[index];
  useEffect(() => {
    setLimit(60);
    setActive(null);
  }, [uid]);
  const move = (direction: number) => {
    if (photos.length)
      setActive(
        photos[(index + direction + photos.length) % photos.length].key,
      );
  };
  return (
    <>
      <Navbar
        title="Moje galerie"
        onMenuClick={() => setMenu(true)}
        onHomeClick={() => router.push("/")}
      />
      <Sidebar
        visible={menu}
        onClose={() => setMenu(false)}
      />
      <main className="container my-gallery-page">
            {state.error && (
              <p role="status">
                Galerii se nepodařilo obnovit.
                {photos.length
                  ? " Zobrazuji poslední načtené fotografie."
                  : " Zkus stránku obnovit."}
              </p>
            )}
            {(!uid || state.loading) && !photos.length ? (
              <p role="status">Načítám tvoje fotografie…</p>
            ) : photos.length ? (
              <>
                <p className="chart-hint">
                  Fotografie: {photos.length} · Záznamy:{" "}
                  {new Set(photos.map((p) => p.runId)).size}
                </p>
                <section
                  className="my-gallery-grid"
                  aria-label="Fotografie mých záznamů"
                >
                  {photos.slice(0, limit).map((item) => (
                    <Photo
                      key={item.key}
                      photo={item}
                      onOpen={() => setActive(item.key)}
                    />
                  ))}
                </section>
                {limit < photos.length && (
                  <button
                    type="button"
                    className="tile-button"
                    onClick={() => setLimit((value) => value + 60)}
                  >
                    Zobrazit další fotografie
                  </button>
                )}
              </>
            ) : (
              !state.error && (
                <div className="tile my-gallery-empty">
                  <Camera size={30} />
                  <p>Zatím nemáš žádné fotografie.</p>
                  <button
                    type="button"
                    className="tile-button"
                    onClick={() => router.push("/myruns")}
                  >
                    Moje aktivity
                  </button>
                </div>
              )
            )}
        {photo && (
          <MyGalleryViewer
            photo={photo}
            onClose={() => setActive(null)}
            onMove={move}
            onOpenRun={() => {
              setActive(null);
              router.push("/#run-" + encodeURIComponent(photo.runId));
            }}
          />
        )}
      </main>
    </>
  );
}
