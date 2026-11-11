"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import { Activity, Clock3, Medal, Users, Footprints, ArrowDownUp, ListFilter } from "lucide-react";
import type { RunData } from "../types";
import { fetchAllRuns } from "../lib/services/runs";
import { getUserAvatars } from "../lib/services/users";
import { cloudinaryImageUrl } from "../lib/imageUrl";

type Participant = {
  uid: string;
  name: string;
  avatarUrl: string;
  km: number;
  minutes: number;
  activities: number;
};

type RunRecord = RunData;

export default function ParticipantsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const loading = runsLoading;
  const [sortMode, setSortMode] = useState<"km" | "alpha">("km");
  const [activeLetter, setActiveLetter] = useState("");
  const [letterPop, setLetterPop] = useState("");
  const letterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) router.push("/login");
    });
    return unsub;
  }, [router]);

  useEffect(() => () => {
    if (letterTimer.current) {
      clearTimeout(letterTimer.current);
      letterTimer.current = null;
    }
  }, []);


  useEffect(() => {
    let active = true;
    setRunsLoading(true);
    setRunsError("");
    void fetchAllRuns().then(items => {
      if (active) setRuns(items);
    }).catch(error => {
      if (active) {
        setRuns([]);
        setRunsError(error instanceof Error ? error.message : "Výsledky se nepodařilo načíst.");
      }
    }).finally(() => {
      if (active) setRunsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const ids = Array.from(new Set(runs.map(item => item.uid).filter((uid): uid is string => typeof uid === "string" && !!uid)));
    if (!ids.length) { setAvatars({}); return () => { active = false; }; }
    void getUserAvatars(ids).then(next => { if (active) setAvatars(next); }).catch(error => { if (active) console.error("Nepodařilo se načíst avatary účastníků", error); });
    return () => { active = false; };
  }, [runs]);

  const participants = useMemo<Participant[]>(() => {
    const map: Record<string, Participant> = {};
    runs.filter(run => (run.type || "běh") === selectedType).forEach(run => {
      const uid = typeof run.uid === "string" ? run.uid : "";
      if (!uid) return;
      const name = run.nickname || run.email?.split("@")[0] || "Anonym";
      if (!map[uid]) map[uid] = { uid, name, avatarUrl: avatars[uid] || run.avatarUrl || "", km: 0, minutes: 0, activities: 0 };
      map[uid].name = name;
      if (avatars[uid] || !map[uid].avatarUrl) map[uid].avatarUrl = avatars[uid] || run.avatarUrl || "";
      map[uid].km += Number(run.km) || 0;
      map[uid].minutes += Number(run.minuty) || 0;
      map[uid].activities += 1;
    });
    return Object.values(map).sort((a, b) => sortMode === "alpha" ? a.name.localeCompare(b.name, "cs", { sensitivity: "base" }) : b.km - a.km);
  }, [runs, selectedType, avatars, sortMode]);

  const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const availableLetters = useMemo(() => new Set(participants.map(p => p.name.trim().charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())), [participants]);
  const jumpToLetter = (letter: string) => {
    if (sortMode !== "alpha" || !availableLetters.has(letter)) return;
    const target = document.querySelector(`[data-letter="${letter}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveLetter(letter);
    setLetterPop(letter);
    if (letterTimer.current) clearTimeout(letterTimer.current);
    letterTimer.current = setTimeout(() => setLetterPop(""), 500);
  };

  const totalKm = participants.reduce((sum, item) => sum + item.km, 0);
  const totalMinutes = participants.reduce((sum, item) => sum + item.minutes, 0);
  const totalActivities = participants.reduce((sum, item) => sum + item.activities, 0);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    if (item === "trainer") { router.push("/trainer"); return; }
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

        <div className="participants-toolbar">
          <span className="control-caption">Řazení</span>
          <div className="participant-sort" role="group" aria-label="Řazení účastníků">
            <button type="button" className={`participant-sort-button${sortMode === "km" ? " active" : ""}`} onClick={() => setSortMode("km")}><ArrowDownUp size={17} /> Kilometry</button>
            <button type="button" className={`participant-sort-button${sortMode === "alpha" ? " active" : ""}`} onClick={() => setSortMode("alpha")}><ListFilter size={17} /> Abeceda</button>
          </div>
        </div>

        <section className="participants-summary">
          <div className="tile participant-summary-card"><Users size={21}/><span>Účastníci</span><strong>{participants.length}</strong></div>
          <div className="tile participant-summary-card"><Footprints size={21}/><span>Celkem km</span><strong>{totalKm.toFixed(1)} km</strong></div>
          <div className="tile participant-summary-card"><Activity size={21}/><span>Aktivity</span><strong>{totalActivities}</strong></div>
          <div className="tile participant-summary-card"><Clock3 size={21}/><span>Čas</span><strong>{Math.floor(totalMinutes / 60)} h {Math.round(totalMinutes % 60)} min</strong></div>
        </section>

        <section className="tile participants-list-card">
          <div className="results-section-heading"><Medal size={22}/><div><h2>Žebříček účastníků</h2><p>Seřazeno podle celkové vzdálenosti.</p></div></div>
          {loading ? <p className="admin-muted">Načítám výsledky…</p> : runsError ? <div className="participants-empty">{runsError}</div> : participants.length === 0 ? (
            <div className="participants-empty">Zatím nejsou pro {selectedType === "běh" ? "běh" : "chůzi"} žádné záznamy.</div>
          ) : (
            <div className="participants-scroll-area">
              {letterPop && <div className="participants-letter-pop" aria-hidden="true">{letterPop}</div>}
              <div className="participants-list">
              {participants.map((participant, index) => {
                const averagePace = participant.km > 0 ? participant.minutes / participant.km : 0;
                return (
                  <button type="button" className="participant-row" key={participant.uid} data-letter={sortMode === "alpha" ? participant.name.trim().charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : undefined} onClick={() => router.push("/user/" + participant.uid)}>
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
            </div>
          )}
        </section>
        {sortMode === "alpha" && (
          <nav className="participants-alpha participants-alpha-fixed" aria-label="Abecední navigace">
            {alphabet.map(letter => (
              <button key={letter} type="button" className={`${activeLetter === letter ? "active " : ""}${availableLetters.has(letter) ? "" : "disabled"}`} onClick={() => jumpToLetter(letter)}>{letter}</button>
            ))}
          </nav>
        )}
      </main>
    </>
  );
}
