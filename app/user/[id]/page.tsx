"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import ActivityCard from "../../components/ActivityCard";
import ActivityTypeSelector, { ActivityType } from "../../components/ActivityTypeSelector";
import { cloudinaryImageUrl } from "../../lib/imageUrl";

type RunData = {
  id: string; uid?: string; email?: string; nickname?: string; avatarUrl?: string;
  km?: number; minuty?: number; tempo?: number | string; type?: string; teamId?: string;
  imageUrls?: string[]; imageUrl?: string; timestamp?: { seconds: number }; likedBy?: string[]; likeCount?: number; commentCount?: number;
};

export default function UserPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [userInfo, setUserInfo] = useState({ nickname: "", avatarUrl: "", email: "" });
  const [teams, setTeams] = useState<{ id: string; name?: string }[]>([]);
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "runs"), where("uid", "==", id));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(item => ({ id: item.id, ...item.data() } as RunData));
      items.sort((a, b) => {
        const at = a.timestamp?.seconds || 0;
        const bt = b.timestamp?.seconds || 0;
        return bt - at;
      });
      setRuns(items);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snapshot = await getDoc(doc(db, "users", id));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUserInfo({
            nickname: data.nickname || "",
            avatarUrl: data.avatarUrl || "",
            email: data.email || "",
          });
        }
      } catch (error) { console.error("Nepodařilo se načíst profil uživatele", error); }
    };
    if (id) void fetchUser();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), snap => {
      setTeams(snap.docs.map(item => ({ id: item.id, name: item.data().name })));
    });
    return () => unsub();
  }, []);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  const profileName = userInfo.nickname || userInfo.email?.split("@")[0] || "Uživatel";
  const filteredRuns = runs.filter(run => (run.type || "běh") === selectedType);

  const showRunImages = (images: string[], fallback: string) => {
    const urls = images.length ? images : fallback ? [fallback] : [];
    if (!urls.length) return;
    setShowImages(urls);
    setCurrentImageIndex(0);
  };

  return (
    <>
      <Navbar title={profileName} onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container user-page-modern">
        <header className="user-page-header">
          <div className="user-page-avatar">
            {userInfo.avatarUrl ? <img src={cloudinaryImageUrl(userInfo.avatarUrl, 128)} alt="" /> : profileName.charAt(0).toUpperCase()}
          </div>
          <div><span className="user-page-eyebrow">AKTIVITY UŽIVATELE</span><h1>{profileName}</h1><p>{filteredRuns.length} {filteredRuns.length === 1 ? "aktivita" : filteredRuns.length < 5 ? "aktivity" : "aktivit"} · {filteredRuns.reduce((sum, run) => sum + (Number(run.km) || 0), 0).toFixed(1)} km</p></div>
        </header>

        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Typ aktivity" />

        <div className="list-container user-activity-list">
          {filteredRuns.map(run => {
            const teamName = run.teamId ? teams.find(team => team.id === run.teamId)?.name || null : null;
            const images = Array.isArray(run.imageUrls) && run.imageUrls.length ? run.imageUrls : run.imageUrl ? [run.imageUrl] : [];
            return (
              <ActivityCard
                key={run.id}
                run={run}
                nickname={profileName}
                avatarUrl={userInfo.avatarUrl}
                teamName={teamName}
                activityType={selectedType}
                onPhotosClick={showRunImages}
              />
            );
          })}
        </div>

        {!filteredRuns.length && <div className="tile activity-empty-state"><strong>Žádné záznamy</strong><p>Tento uživatel zatím nemá pro zvolený typ aktivity žádný záznam.</p></div>}
      </main>

      {showImages && showImages.length > 0 && (
        <div className="activity-lightbox" role="dialog" aria-modal="true" aria-label="Galerie fotografií" onClick={() => setShowImages(null)}>
          <div className="activity-lightbox-top" onClick={e => e.stopPropagation()}>
            <span>{currentImageIndex + 1} / {showImages.length}</span>
            <button type="button" onClick={() => setShowImages(null)} aria-label="Zavřít galerii">×</button>
          </div>
          <img src={cloudinaryImageUrl(showImages[currentImageIndex], 1600)} alt={`Fotografie ${currentImageIndex + 1}`} onClick={e => e.stopPropagation()} />
          <div className="activity-lightbox-actions" onClick={e => e.stopPropagation()}>
            {showImages.length > 1 ? <button type="button" onClick={() => setCurrentImageIndex(i => (i - 1 + showImages.length) % showImages.length)} aria-label="Předchozí fotografie">‹</button> : <span />}
            <button type="button" onClick={() => setShowImages(null)}>Zavřít</button>
            {showImages.length > 1 ? <button type="button" onClick={() => setCurrentImageIndex(i => (i + 1) % showImages.length)} aria-label="Další fotografie">›</button> : <span />}
          </div>
          {showImages.length > 1 && <div className="activity-lightbox-thumbs" onClick={e => e.stopPropagation()}>{showImages.map((url, index) => <button key={url + index} type="button" className={index === currentImageIndex ? "active" : ""} onClick={() => setCurrentImageIndex(index)} aria-label={`Fotografie ${index + 1}`}><img src={cloudinaryImageUrl(url, 180)} alt="" /></button>)}</div>}
        </div>
      )}
    </>
  );
}
