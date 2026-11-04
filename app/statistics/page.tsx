"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { collection, query, orderBy, getDocs, where, documentId, Timestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import { Footprints } from "lucide-react";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";

export default function StatisticsPage() {

  const [menuVisible, setMenuVisible] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [view, setView] = useState("já");
  const [metric, setMetric] = useState("km");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, u => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsubAuth();
  }, [router]);

  const runsQuery = useMemo(() => {
    const constraints: any[] = [orderBy("timestamp", "desc")];
    if (startDate) constraints.unshift(where("timestamp", ">=", Timestamp.fromDate(new Date(startDate + "T00:00:00"))));
    if (endDate) constraints.unshift(where("timestamp", "<=", Timestamp.fromDate(new Date(endDate + "T23:59:59.999"))));
    return query(collection(db, "runs"), ...constraints);
  }, [startDate, endDate]);
  const teamsQuery = useMemo(() => query(collection(db, "teams")), []);
  const runsState = useSharedFirestoreQuery<any>("runs:statistics:" + (startDate || "all") + ":" + (endDate || "all"), runsQuery);
  const teamsState = useSharedFirestoreQuery<any>("teams:all", teamsQuery);
  const runs = runsState.data;
  const teams = teamsState.data;

  useEffect(() => {
    const ids = Array.from(new Set(runs.map((run) => run.uid).filter((id): id is string => typeof id === "string" && !!id)));
    if (!ids.length) { setAvatars({}); return; }
    let cancelled = false;
    const loadAvatars = async () => {
      try {
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
        const snapshots = await Promise.all(batches.map((batch) =>
          getDocs(query(collection(db, "users"), where(documentId(), "in", batch)))
        ));
        if (cancelled) return;
        const next: Record<string, string> = {};
        snapshots.forEach((snapshot) => snapshot.docs.forEach((profile) => {
          next[profile.id] = profile.data().avatarUrl || "";
        }));
        setAvatars(next);
      } catch (error) { console.error("Nepodařilo se načíst avatary ve výsledcích", error); }
    };
    void loadAvatars();
    return () => { cancelled = true; };
  }, [runs]);

  const filtered = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = new Date(run.timestamp?.seconds ? run.timestamp.seconds*1000 : run.timestamp);
    if (startDate && new Date(startDate) > date) return false;
    if (endDate && new Date(endDate+"T23:59") < date) return false;
    return true;
  });

  // Agregujeme podle UID, nikoli podle přezdívky: dva lidé mohou mít stejné jméno.
  const userMap: Record<string, { name: string; km: number; min: number }> = {};
  const teamMap: Record<string, {
    team: string;
    km: number;
    min: number;
    members: Record<string, { name: string; km: number; min: number }>;
  }> = {};

  filtered.forEach(run => {
    const uid = typeof run.uid === "string" ? run.uid : "";
    if (!uid) return;

    const name = run.nickname || run.email?.split("@")[0] || "Anonym";
    const km = Number(run.km) || 0;
    const min = Number(run.minuty) || 0;

    if (!userMap[uid]) userMap[uid] = { name, km: 0, min: 0 };
    userMap[uid].name = name;
    userMap[uid].km += km;
    userMap[uid].min += min;

    if (typeof run.teamId === "string" && run.teamId) {
      const teamId = run.teamId;
      const teamName = teams.find(t => t.id === teamId)?.name || "Smazaný tým";
      if (!teamMap[teamId]) teamMap[teamId] = { team: teamName, km: 0, min: 0, members: {} };
      teamMap[teamId].km += km;
      teamMap[teamId].min += min;
      if (!teamMap[teamId].members[uid]) {
        teamMap[teamId].members[uid] = { name, km: 0, min: 0 };
      }
      teamMap[teamId].members[uid].name = name;
      teamMap[teamId].members[uid].km += km;
      teamMap[teamId].members[uid].min += min;
    }
  });

  const userList = Object.entries(userMap).map(([uid, data]) => ({
    uid, name: data.name, avatarUrl: avatars[uid] || "", km: data.km, tempo: data.km ? data.min / data.km : 0
  })).sort((a, b) => metric === "tempo" ? a.tempo - b.tempo : b.km - a.km);

  const teamList = Object.entries(teamMap).map(([id, data]) => ({
    id, team: data.team, km: data.km,
    tempo: data.km ? data.min / data.km : 0, members: data.members
  })).sort((a, b) => metric === "tempo" ? a.tempo - b.tempo : b.km - a.km);

  let myTeamName: string | null = null;
  let myPos = userList.findIndex(x => x.uid === user?.uid) + 1;
  let myTeamPos: number | null = null;
  let myTeamPosInside: number | null = null;

  teamList.forEach((team, idx) => {
    if (user?.uid && team.members[user.uid]) {
      myTeamName = team.team;
      myTeamPos = idx + 1;

      const insideList = Object.entries(team.members).map(([uid, data]) => ({
        uid, name: data.name, km: data.km, tempo: data.km ? data.min / data.km : 0
      })).sort((a, b) => metric === "tempo" ? a.tempo - b.tempo : b.km - a.km);
      myTeamPosInside = insideList.findIndex(member => member.uid === user.uid) + 1;
    }
  });

  let totalKm = 0, totalMin = 0;
  if (view==="já") {
    const myRuns = filtered.filter(r => r.uid===user?.uid);
    totalKm = myRuns.reduce((a,b)=>a+Number(b.km||0),0);
    totalMin = myRuns.reduce((a,b)=>a+Number(b.minuty||0),0);
  } else if (view==="jednotlivci") {
    totalKm = userList.reduce((a,b)=>a+b.km,0);
    totalMin = userList.reduce((a,b)=>a+(b.tempo*b.km||0),0);
  } else if (view==="týmy") {
    totalKm = teamList.reduce((a,b)=>a+b.km,0);
    totalMin = teamList.reduce((a,b)=>a+(b.tempo*b.km||0),0);
  }
  const avgTempo = totalKm ? (totalMin/totalKm).toFixed(2) : 0;

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else if (item === "home") { router.push("/"); }
    else if (item === "myrun") {
      router.push("/myruns");
    } else {
      router.push(`/${item}`);
    }
  };

  const podiumData = view==="jednotlivci" ? userList : teamList;

  return (
    <>
      <Navbar title="Výsledky" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        

        <div className="control-caption">Typ aktivity</div>
        <div className="tile-group">
          <button className={`tile-button ${selectedType==="běh"?"active":""}`} onClick={()=>setSelectedType("běh")}><svg className="run-profile-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="21" cy="5" r="3" fill="currentColor"/><path d="M17 10l-5 5 5 3 4-5 5 2M12 15l-6-1-3 4M17 18l-4 6-7 4M20 18l4 5 5 2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg> Běh</button>
          <button className={`tile-button ${selectedType==="chůze"?"active":""}`} onClick={()=>setSelectedType("chůze")}><Footprints size={25} strokeWidth={2.8} /> Chůze</button>
        </div>
        <div className="control-caption">Zobrazit výsledky</div>
        <div className="tile-group">
          <button className={`tile-button ${view==="já"?"active":""}`} onClick={()=>setView("já")}>Já</button>
          <button className={`tile-button ${view==="jednotlivci"?"active":""}`} onClick={()=>setView("jednotlivci")}>Jednotlivci</button>
          <button className={`tile-button ${view==="týmy"?"active":""}`} onClick={()=>setView("týmy")}>Týmy</button>
        </div>
        <div className="control-caption">Hodnocené podle</div>
        <div className="tile-group">
          <button className={`tile-button ${metric==="km"?"active":""}`} onClick={()=>setMetric("km")}>Km</button>
          <button className={`tile-button ${metric==="tempo"?"active":""}`} onClick={()=>setMetric("tempo")}>Tempo</button>
        </div>

        <div className="tile date-filter">
          <label className="date-field"><span>Od data</span><input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} /></label>
          <label className="date-field"><span>Do data</span><input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} /></label>
          {(startDate || endDate) && <button className="date-clear" onClick={()=>{setStartDate("");setEndDate("");}}>Zrušit filtr</button>}
        </div>

        <div className="tile-group stat-summary-grid" style={{ flexWrap:"wrap" }}>
          <div className="tile">Celkem km<br />{totalKm.toFixed(2)}</div>
          <div className="tile">Prům. tempo<br />{avgTempo} min/km</div>
          <div className="tile">Počet<br />{view==="já"?filtered.filter(r=>r.uid===user?.uid).length:view==="jednotlivci"?userList.length:teamList.length}</div>
        </div>

        {view==="já" && (
          <div style={{ textAlign:"center", marginTop:"1rem" }}>
            <p>🥇 Pořadí mezi jednotlivci: {myPos || "-"}</p>
            <p>🥈 Tvůj tým ({myTeamName || "-"}) je: {myTeamPos || "-"}</p>
            <p>🥉 Tvé pořadí v týmu: {myTeamPosInside || "-"}</p>
          </div>
        )}

        {view!=="já" && (
          <>
            <h3 className="centered-title">🏆 Stupně vítězů</h3>
            <ul style={{ listStyle:"none", padding:0 }}>
              {podiumData.slice(0,3).map((item, idx) => {
                let label = "";
                if (view === "jednotlivci" && "name" in item) label = item.name;
                else if (view === "týmy" && "team" in item) label = item.team;

                return (
                  <li key={idx} className="tile" style={{ display:"flex", alignItems:"center",
                    background: idx===0?"gold":idx===1?"silver":idx===2?"#cd7f32":"rgba(0,0,0,0.2)" }}>
                    <div style={{ marginRight:"0.8rem" }}>{idx+1}.</div>
                    <div className="avatar">{view === "jednotlivci" && "uid" in item && item.avatarUrl ? <img src={item.avatarUrl} alt={`Avatar ${label}`} /> : label?.charAt(0).toUpperCase()}</div>
                    <div style={{ marginLeft:"0.6rem" }}>
                      {label} — {metric==="km"
                        ? `${item.km.toFixed(2)} km`
                        : `${item.tempo.toFixed(2)} min/km`}
                    </div>
                  </li>
                );
              })}
            </ul>

            <h3 className="centered-title" style={{ marginTop:"2rem" }}>📊 Ostatní</h3>
            <ul style={{ listStyle:"none", padding:0 }}>
              {podiumData.slice(3).map((item, idx) => {
                let label = "";
                if (view === "jednotlivci" && "name" in item) label = item.name;
                else if (view === "týmy" && "team" in item) label = item.team;

                return (
                  <li key={idx} className="tile" style={{ display:"flex", alignItems:"center" }}>
                    <div style={{ marginRight:"0.8rem" }}>{idx+4}.</div>
                    <div className="avatar">{label?.charAt(0).toUpperCase()}</div>
                    <div style={{ marginLeft:"0.6rem" }}>
                      {label} — {metric==="km"
                        ? `${item.km.toFixed(2)} km`
                        : `${item.tempo.toFixed(2)} min/km`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}


