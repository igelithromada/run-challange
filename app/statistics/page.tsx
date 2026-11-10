"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User as AuthUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import { Footprints, Medal, Trophy, Users, User, MapPin, Clock3, Gauge, ListChecks } from "lucide-react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import { activityMetrics, formatPace } from "../lib/activityMetrics";
import type { RunData, TeamData, ActivityType } from "../types";
import { allTeamsQuery } from "../lib/services/teams";
import { getUserAvatars } from "../lib/services/users";
import { filteredRunsQuery } from "../lib/services/runs";

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
    const unsub = onAuthStateChanged(auth, u => { if (!u) router.push("/login"); else setUser(u); });
    return () => unsub();
  }, [router]);

  const runsQuery = useMemo(() => filteredRunsQuery(startDate || undefined, endDate || undefined), [startDate, endDate]);
  const teamsQuery = useMemo(() => allTeamsQuery(), []);
  const runsState = useSharedFirestoreQuery<RunData>("runs:statistics:" + (startDate || "all") + ":" + (endDate || "all"), runsQuery);
  const teamsState = useSharedFirestoreQuery<TeamData>("teams:all", teamsQuery);
  const runs = runsState.data;
  const teams = teamsState.data;

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

  const userMap: Record<string, { name: string; km: number; min: number }> = {};
  const teamMap: Record<string, { team: string; km: number; min: number; members: Record<string, { name: string; km: number; min: number }> }> = {};
  filtered.forEach(run => {
    const uid = typeof run.uid === "string" ? run.uid : "";
    if (!uid) return;
    const name = run.nickname || run.email?.split("@")[0] || "Anonym";
    const km = Number(run.km) || 0;
    const min = Number(run.minuty) || 0;
    if (!userMap[uid]) userMap[uid] = { name, km: 0, min: 0 };
    userMap[uid].name = name; userMap[uid].km += km; userMap[uid].min += min;
    if (run.teamId) {
      const teamId = run.teamId;
      const teamName = teams.find(t => t.id === teamId)?.name || "Smazaný tým";
      if (!teamMap[teamId]) teamMap[teamId] = { team: teamName, km: 0, min: 0, members: {} };
      teamMap[teamId].km += km; teamMap[teamId].min += min;
      if (!teamMap[teamId].members[uid]) teamMap[teamId].members[uid] = { name, km: 0, min: 0 };
      teamMap[teamId].members[uid].name = name; teamMap[teamId].members[uid].km += km; teamMap[teamId].members[uid].min += min;
    }
  });

  const userList = Object.entries(userMap).map(([uid, data]) => ({ uid, name: data.name, avatarUrl: avatars[uid] || "", km: data.km, tempo: data.km ? data.min / data.km : 0 })).sort((a,b) => metric === "tempo" ? a.tempo-b.tempo : b.km-a.km);
  const teamList = Object.entries(teamMap).map(([id,data]) => ({ id, team:data.team, km:data.km, tempo:data.km ? data.min/data.km : 0, members:data.members })).sort((a,b) => metric === "tempo" ? a.tempo-b.tempo : b.km-a.km);

  let myTeamName: string | null = null;
  const myPos = userList.findIndex(x => x.uid === user?.uid) + 1;
  let myTeamPos: number | null = null;
  let myTeamPosInside: number | null = null;
  teamList.forEach((team, idx) => {
    if (user?.uid && team.members[user.uid]) {
      myTeamName = team.team; myTeamPos = idx + 1;
      const insideList = Object.entries(team.members).map(([uid,data]) => ({ uid, name:data.name, km:data.km, tempo:data.km ? data.min/data.km : 0 })).sort((a,b) => metric === "tempo" ? a.tempo-b.tempo : b.km-a.km);
      myTeamPosInside = insideList.findIndex(member => member.uid === user.uid) + 1;
    }
  });

  let totalKm = 0, totalMin = 0;
  if (view === "já") {
    const mine = filtered.filter(r => r.uid === user?.uid);
    totalKm = mine.reduce((a,b) => a + Number(b.km || 0), 0);
    totalMin = mine.reduce((a,b) => a + Number(b.minuty || 0), 0);
  } else if (view === "jednotlivci") {
    totalKm = userList.reduce((a,b) => a+b.km,0); totalMin = userList.reduce((a,b) => a+(b.tempo*b.km || 0),0);
  } else {
    totalKm = teamList.reduce((a,b) => a+b.km,0); totalMin = teamList.reduce((a,b) => a+(b.tempo*b.km || 0),0);
  }
  const overallMetrics = activityMetrics(filtered.filter(r => view === "já" ? r.uid === user?.uid : true));
  const avgTempo = overallMetrics.pace;
  const podiumData = view === "jednotlivci" ? userList : teamList;
  const count = view === "já" ? filtered.filter(r => r.uid === user?.uid).length : view === "jednotlivci" ? userList.length : teamList.length;

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    if (item === "trainer") { router.push("/trainer"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  return (
    <>
      <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container statistics-page">
        {runsState.loading || teamsState.loading ? (
          <LoadingSkeleton count={3} />
        ) : runsState.error || teamsState.error ? (
          <div className="tile form-message-error" role="alert">Výsledky se nepodařilo načíst. Zkus stránku obnovit.</div>
        ) : null}

        <div className="control-caption">Typ aktivity</div>
        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} />

        <div className="control-caption">Zobrazit výsledky</div>
        <div className="tile-group">
          <button className={`tile-button ${view === "já" ? "active" : ""}`} onClick={() => setView("já")}><User size={20}/> Já</button>
          <button className={`tile-button ${view === "jednotlivci" ? "active" : ""}`} onClick={() => setView("jednotlivci")}><Users size={20}/> Jednotlivci</button>
          <button className={`tile-button ${view === "týmy" ? "active" : ""}`} onClick={() => setView("týmy")}><Users size={20}/> Týmy</button>
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
            <div className="results-position-row"><span><Users size={20}/> Tým</span><strong>{myTeamName || "—"} {myTeamPos ? `· ${myTeamPos}. místo` : ""}</strong></div>
            <div className="results-position-row"><span><Medal size={20}/> Pořadí v týmu</span><strong>{myTeamPosInside ? `${myTeamPosInside}.` : "—"}</strong></div>
          </section>
        )}

        {view !== "já" && (
          <>
            <section className="results-section">
              <div className="results-section-heading"><Trophy size={22}/><div><h2>Stupně vítězů</h2><p>Nejlepší výsledky podle zvoleného období a kritéria.</p></div></div>
              <ul className="results-podium">
                {podiumData.slice(0,3).map((item, idx) => {
                  const label = view === "jednotlivci" && "name" in item ? item.name : "team" in item ? item.team : "";
                  const avatar = view === "jednotlivci" && "avatarUrl" in item ? item.avatarUrl : "";
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
                  const label = view === "jednotlivci" && "name" in item ? item.name : "team" in item ? item.team : "";
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
