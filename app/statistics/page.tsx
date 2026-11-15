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
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (cached === "běh" || cached === "chůze") setSelectedType(cached);
    } catch {}
  }, []);
  const [view, setView] = useState("já");
  const [metric, setMetric] = useState("km");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { if (!u) router.push("/login"); else setUser(u); });
    return () => unsub();
  }, [router]);

  const runsQuery = useMemo(() => filteredRunsQuery(startDate || undefined, endDate || undefined), [startDate, endDate]);
  const runsState = useSharedFirestoreQuery<RunData>("runs:statistics:" + (startDate || "all") + ":" + (endDate || "all"), runsQuery);
  const runs = runsState.data;

  useEffect(() => {
    const ids = Array.from(new Set(runs.map(run => run.uid).filter((id): id is string => typeof id === "string" && !!id)));
    if (!ids.length) { setAvatars({}); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getUserAvatars(ids);
        if (cancelled) return;
        setAvatars(next);
      } catch (error) { console.error("Nepodařilo se načíst avatary ve výsledcích", error); }
    };
    void load();
    return () => { cancelled = true; };
  }, [runs]);

  const filtered = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const timestamp = run.timestamp;
    const date = !timestamp ? new Date(0) : timestamp instanceof Date ? timestamp : "toDate" in timestamp && typeof timestamp.toDate === "function" ? timestamp.toDate() : "seconds" in timestamp && typeof timestamp.seconds === "number" ? new Date(timestamp.seconds * 1000) : new Date(0);
    if (startDate && new Date(startDate) > date) return false;
    if (endDate && new Date(endDate + "T23:59") < date) return false;
    return true;
  });

  const userMap: Record<string, { name: string; km: number; min: number; avatarUrl?: string }> = {};
  filtered.forEach(run => {
    const uid = typeof run.uid === "string" ? run.uid : "";
    if (!uid) return;
    const name = run.nickname || run.email?.split("@")[0] || "Anonym";
    const km = Number(run.km) || 0;
    const min = Number(run.minuty) || 0;
    if (!userMap[uid]) userMap[uid] = { name, km: 0, min: 0, avatarUrl: run.avatarUrl || "" };
    userMap[uid].name = name;
    if (!userMap[uid].avatarUrl && run.avatarUrl) userMap[uid].avatarUrl = run.avatarUrl;
    userMap[uid].km += km; userMap[uid].min += min;
  });

  const userList = Object.entries(userMap).map(([uid, data]) => ({ uid, name: data.name, avatarUrl: avatars[uid] || data.avatarUrl || "", km: data.km, tempo: data.km ? data.min / data.km : 0 })).sort((a,b) => metric === "tempo" ? a.tempo-b.tempo : b.km-a.km);
  let totalKm = 0, totalMin = 0;
  if (view === "já") {
    const mine = filtered.filter(r => r.uid === user?.uid);
    totalKm = mine.reduce((a,b) => a + Number(b.km || 0), 0);
    totalMin = mine.reduce((a,b) => a + Number(b.minuty || 0), 0);
  } else {
    totalKm = userList.reduce((a,b) => a+b.km,0);
    totalMin = userList.reduce((a,b) => a+(b.tempo*b.km || 0),0);
  }
  const overallMetrics = activityMetrics(filtered.filter(r => view === "já" ? r.uid === user?.uid : true));
  const avgTempo = overallMetrics.pace;
  const podiumData = userList;
  const count = view === "já" ? filtered.filter(r => r.uid === user?.uid).length : userList.length;

  useEffect(() => {
    if (runsState.error) showAppToast("Výsledky se nepodařilo načíst. Zkus stránku obnovit.", "error");
  }, [runsState.error]);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    if (item === "trainer") { router.push("/trainer"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  if (runsState.loading) {
    return (
      <>
        <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
        <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
        <main className="container statistics-page">
          <LoadingSkeleton count={3} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container statistics-page">
        {/* Chyba načítání se zobrazuje jednotně přes globální AppToast. */}

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

        {view !== "já" && (
          <>
            <section className="results-section">
              <div className="results-section-heading"><Trophy size={22}/><div><h2>Stupně vítězů</h2><p>Nejlepší výsledky podle zvoleného období a kritéria.</p></div></div>
              <ul className="results-podium">
                {podiumData.slice(0,3).map((item, idx) => {
                  const label = item.name;
                  const avatar = item.avatarUrl;
                  return <li key={idx} className={`results-podium-item rank-${idx+1}`}>
                    <span className="results-rank-icon"><Medal /></span>
                    <span className="activity-avatar">{avatar ? <img src={avatar} alt="" /> : label.charAt(0).toUpperCase()}</span>
                    <span className="results-name">{label}</span>
                    <span className="results-value">{metric === "km" ? `${item.km.toFixed(2)} km` : `${item.tempo.toFixed(2)} min/km`}</span>
                  </li>;
                })}
              </ul>
            </section>

            <section className="results-other">
              <div className="results-section-heading"><Users size={22}/><div><h2>Ostatní</h2><p>Další účastníci v pořadí.</p></div></div>
              <ul className="results-podium">
                {podiumData.slice(3).map((item, idx) => {
                  const label = item.name;
                  return <li key={idx} className="results-podium-item"><span className="results-rank-icon"><span>{idx+4}</span></span><span className="activity-avatar">{label.charAt(0).toUpperCase()}</span><span className="results-name">{label}</span><span className="results-value">{metric === "km" ? `${item.km.toFixed(2)} km` : `${item.tempo.toFixed(2)} min/km`}</span></li>;
                })}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
