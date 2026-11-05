"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, query, orderBy, getDocs, where, documentId } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import { Activity, Clock3, Medal, Users, Footprints } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";

type Participant = {
  uid: string;
  name: string;
  avatarUrl: string;
  km: number;
  minutes: number;
  activities: number;
};

export default function ParticipantsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [runs, setRuns] = useState<any[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(query(collection(db, "runs"), orderBy("timestamp", "desc")));
        const items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        setRuns(items);

        const ids = Array.from(new Set(items.map(item => item.uid).filter((uid): uid is string => typeof uid === "string" && !!uid)));
        const next: Record<string, string> = {};
        for (let i = 0; i < ids.length; i += 30) {
          const batch = ids.slice(i, i + 30);
          const profiles = await getDocs(query(collection(db, "users"), where(documentId(), "in", batch)));
          profiles.docs.forEach(profile => { next[profile.id] = profile.data().avatarUrl || ""; });
        }
        setAvatars(next);
      } catch (error) {
        console.error("Nepodařilo se načíst účastníky", error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const participants = useMemo<Participant[]>(() => {
    const map: Record<string, Participant> = {};
    runs.filter(run => (run.type || "běh") === selectedType).forEach(run => {
      const uid = typeof run.uid === "string" ? run.uid : "";
      if (!uid) return;
      const name = run.nickname || run.email?.split("@")[0] || "Anonym";
      if (!map[uid]) map[uid] = { uid, name, avatarUrl: avatars[uid] || "", km: 0, minutes: 0, activities: 0 };
      map[uid].name = name;
      map[uid].km += Number(run.km) || 0;
      map[uid].minutes += Number(run.minuty) || 0;
      map[uid].activities += 1;
    });
    return Object.values(map).sort((a, b) => b.km - a.km);
  }, [runs, selectedType, avatars]);

  const totalKm = participants.reduce((sum, item) => sum + item.km, 0);
  const totalMinutes = participants.reduce((sum, item) => sum + item.minutes, 0);
  const totalActivities = participants.reduce((sum, item) => sum + item.activities, 0);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  return (
    <>
      <Navbar title="Účastníci" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container participants-page">
        <header className="participants-header">
          <span className="participants-eyebrow">SPOLEČNÝ PŘEHLED</span>
          <h1>Účastníci</h1>
          <p>Celkové výsledky všech účastníků. Porovnej, kdo má za sebou nejvíce kilometrů.</p>
        </header>

        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Typ aktivity" />

        <section className="participants-summary">
          <div className="tile participant-summary-card"><Users size={21}/><span>Účastníci</span><strong>{participants.length}</strong></div>
          <div className="tile participant-summary-card"><Footprints size={21}/><span>Celkem km</span><strong>{totalKm.toFixed(1)} km</strong></div>
          <div className="tile participant-summary-card"><Activity size={21}/><span>Aktivity</span><strong>{totalActivities}</strong></div>
          <div className="tile participant-summary-card"><Clock3 size={21}/><span>Čas</span><strong>{Math.floor(totalMinutes / 60)} h {Math.round(totalMinutes % 60)} min</strong></div>
        </section>

        <section className="tile participants-list-card">
          <div className="results-section-heading"><Medal size={22}/><div><h2>Žebříček účastníků</h2><p>Seřazeno podle celkové vzdálenosti.</p></div></div>
          {loading ? <p className="admin-muted">Načítám výsledky…</p> : participants.length === 0 ? (
            <div className="participants-empty">Zatím nejsou pro {selectedType === "běh" ? "běh" : "chůzi"} žádné záznamy.</div>
          ) : (
            <div className="participants-list">
              {participants.map((participant, index) => {
                const averagePace = participant.km > 0 ? participant.minutes / participant.km : 0;
                return (
                  <button type="button" className="participant-row" key={participant.uid} onClick={() => router.push("/user/" + participant.uid)}>
                    <span className="participant-rank">{index < 3 ? <Medal size={19}/> : index + 1}</span>
                    <span className="activity-avatar participant-avatar">
                      {participant.avatarUrl ? <img src={cloudinaryImageUrl(participant.avatarUrl, 96)} alt="" /> : participant.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="participant-main"><strong>{participant.name}</strong><small>{participant.activities} {participant.activities === 1 ? "aktivita" : participant.activities < 5 ? "aktivity" : "aktivit"} · průměr {averagePace.toFixed(2)} min/km</small></span>
                    <span className="participant-distance"><strong>{participant.km.toFixed(1)} km</strong><small>{Math.floor(participant.minutes / 60)} h {Math.round(participant.minutes % 60)} min</small></span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
