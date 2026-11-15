"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User as AuthUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import { Medal, Trophy, Users, User, MapPin, Gauge, ListChecks } from "lucide-react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import { activityMetrics, formatPace } from "../lib/activityMetrics";
import type { RunData, ActivityType } from "../types";
import { getUserAvatars } from "../lib/services/users";
import { filteredRunsQuery } from "../lib/services/runs";
import { showAppToast } from "../components/AppToast";

export default function StatisticsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [view, setView] = useState("já");
  const [metric, setMetric] = useState("km");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (cached === "běh" || cached === "chůze") setSelectedType(cached);
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    if (runsState.loading) {
    return (
      <>
        <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
        <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
        <main className="container statistics-page"><LoadingSkeleton count={3} /></main>
      </>
    );
  }

  return (
    <>
      <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container statistics-page">
        <div className="control-caption">Typ aktivity</div>
        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} />

        <div className="control-caption">Zobrazit výsledky</div>
        <div className="tile-group">
          <button className={`tile-button ${view === "já" ? "active" : ""}`} onClick={() => setView("já")}><User size={20}/> Já</button>
          <button className={`tile-button ${view === "jednotlivci" ? "active" : ""}`} onClick={() => setView("jednotlivci")}><Users size={20}/> Jednotlivci</button>
        </div>

        <div className="control-caption">Hodnocené podle</div>
        <div className="tile-group">
          <button className={`tile-button ${metric === "km" ? "active" : ""}`} onClick={() => setMetric("km")}>Km</button>
          <button className={`tile-button ${metric === "tempo" ? "active" : ""}`} onClick={() => setMetric("tempo")}>Tempo</button>
        </div>

        <div className="tile date-filter">
          <label className="date-field"><span>Od data</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label className="date-field"><span>Do data</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          {(startDate || endDate) && <button className="date-clear" onClick={() => { setStartDate(""); setEndDate(""); }}>Zrušit filtr</button>}
        </div>

        <div className="tile-group stat-summary-grid">
          <div className="tile stat-card"><MapPin/><span>Celkem km</span><strong>{totalKm.toFixed(2)} km</strong></div>
          <div className="tile stat-card"><Gauge/><span>Průměrné tempo</span><strong>{formatPace(avgTempo)}</strong></div>
          <div className="tile stat-card"><ListChecks/><span>Počet</span><strong>{count}</strong></div>
        </div>

        {view === "já" && (
          <section className="tile result-my-position">
            <div className="results-position-row"><span><Trophy size={20}/> Pořadí mezi jednotlivci</span><strong>{myPos || "—"}.</strong></div>
          </section>
        )}

        {view === "jednotlivci" && (
          <>
            <section className="results-section">
              <div className="results-section-heading"><Trophy size={22}/><div><h2>Stupně vítězů</h2><p>Nejlepší výsledky podle zvoleného období a kritéria.</p></div></div>
              <ul className="results-podium">
                {podiumData.slice(0,3).map((item, idx) => (
                  <li key={item.uid} className={`results-podium-item rank-${idx+1}`}>
                    <span className="results-rank-icon"><Medal /></span>
                    <span className="activity-avatar">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.charAt(0).toUpperCase()}</span>
                    <span className="results-name">{item.name}</span>
                    <span className="results-value">{metric === "km" ? `${item.km.toFixed(2)} km` : `${item.tempo.toFixed(2)} min/km`}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="results-other">
              <div className="results-section-heading"><Users size={22}/><div><h2>Ostatní</h2><p>Další účastníci v pořadí.</p></div></div>
              <ul className="results-podium">
                {podiumData.slice(3).map((item, idx) => (
                  <li key={item.uid} className="results-podium-item">
                    <span className="results-rank-icon"><span>{idx+4}</span></span>
                    <span className="activity-avatar">{item.name.charAt(0).toUpperCase()}</span>
                    <span className="results-name">{item.name}</span>
                    <span className="results-value">{metric === "km" ? `${item.km.toFixed(2)} km` : `${item.tempo.toFixed(2)} min/km`}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
