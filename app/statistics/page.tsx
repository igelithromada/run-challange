"use client";
import React, { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";

export default function StatisticsPage() {
  useThemeLoader();

  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [view, setView] = useState("já");
  const [metric, setMetric] = useState("km");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });

    const unsubRuns = onSnapshot(query(collection(db, "runs"), orderBy("timestamp", "desc")),
      (snap) => setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    const unsubTeams = onSnapshot(collection(db, "teams"),
      (snap) => setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    return () => { unsubAuth(); unsubRuns(); unsubTeams(); }
  }, [router]);

  // === FILTRY
  const filtered = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = new Date(run.timestamp?.seconds ? run.timestamp.seconds*1000 : run.timestamp);
    if (startDate && new Date(startDate) > date) return false;
    if (endDate && new Date(endDate+"T23:59") < date) return false;
    return true;
  });

  // === DATOVÉ MAPY
  const userMap: { [key: string]: { km: number; min: number } } = {};
  const teamMap: {
  [teamName: string]: {
    km: number;
    min: number;
    members: {
      [memberName: string]: {
        km: number;
        min: number;
      };
    };
  };
} = {};
  filtered.forEach(run => {
    const name = run.nickname || run.email?.split("@")[0] || "Anonym";
    const team = teams.find(t => t.id===run.teamId)?.name || "?";

    // jednotlivec
    if (!userMap[name]) userMap[name]={ km:0,min:0 };
    userMap[name].km += Number(run.km||0);
    userMap[name].min += Number(run.minuty||0);

    // tým
    if (!teamMap[team]) teamMap[team]={ km:0,min:0, members:{} };
    teamMap[team].km += Number(run.km||0);
    teamMap[team].min += Number(run.minuty||0);
    if (!teamMap[team].members[name]) teamMap[team].members[name]={ km:0,min:0 };
    teamMap[team].members[name].km += Number(run.km||0);
    teamMap[team].members[name].min += Number(run.minuty||0);
  });

  // === POŘADÍ
  const userList = Object.entries(userMap).map(([name,data])=>({
    name, km:data.km, tempo:data.km?(data.min/data.km):0
  })).sort((a,b)=>b[metric]-a[metric]);

  const teamList = Object.entries(teamMap).map(([team,data])=>({
    team, km:data.km, tempo:data.km?(data.min/data.km):0, members:data.members
  })).sort((a,b)=>b[metric]-a[metric]);

  // === MÉ POŘADÍ
  let myName = user?.email?.split("@")[0] || "?";
  let myTeamName = null;
  let myPos = userList.findIndex(x=>x.name===myName)+1;
  let myTeamPos = null;
  let myTeamPosInside = null;

  teamList.forEach((t, idx) => {
    if (Object.keys(t.members).includes(myName)) {
      myTeamName = t.team;
      myTeamPos = idx+1;

      const insideList = Object.entries(t.members).map(([name,data])=>({
        name, km:data.km, tempo:data.km?(data.min/data.km):0
      })).sort((a,b)=>b[metric]-a[metric]);
      myTeamPosInside = insideList.findIndex(x=>x.name===myName)+1;
    }
  });

  // === TILE SUM
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

  // === HANDLER
  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item==="logout") await signOut(auth).then(()=>router.push("/login"));
    else router.push(`/${item}`);
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Statistiky</h1>

        <div className="tile-group">
          <button className={`tile-button ${selectedType==="běh"?"active":""}`} onClick={()=>setSelectedType("běh")}>🏃 Běh</button>
          <button className={`tile-button ${selectedType==="chůze"?"active":""}`} onClick={()=>setSelectedType("chůze")}>🚶 Chůze</button>
        </div>
        <div className="tile-group">
          <button className={`tile-button ${view==="já"?"active":""}`} onClick={()=>setView("já")}>Já</button>
          <button className={`tile-button ${view==="jednotlivci"?"active":""}`} onClick={()=>setView("jednotlivci")}>Jednotlivci</button>
          <button className={`tile-button ${view==="týmy"?"active":""}`} onClick={()=>setView("týmy")}>Týmy</button>
        </div>
        <div className="tile-group">
          <button className={`tile-button ${metric==="km"?"active":""}`} onClick={()=>setMetric("km")}>Km</button>
          <button className={`tile-button ${metric==="tempo"?"active":""}`} onClick={()=>setMetric("tempo")}>Tempo</button>
        </div>

        <div className="tile" style={{ textAlign:"center" }}>
          <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}
            style={{ padding:"0.4rem", borderRadius:"8px", border:"none", marginRight:"0.5rem" }} />
          <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)}
            style={{ padding:"0.4rem", borderRadius:"8px", border:"none" }} />
        </div>

        <div className="tile-group" style={{ flexWrap:"wrap" }}>
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
              {(view==="jednotlivci"?userList:teamList).slice(0,3).map((item, idx)=>(
                <li key={idx} className="tile" style={{ display:"flex", alignItems:"center",
                  background: idx===0?"gold":idx===1?"silver":idx===2?"#cd7f32":"rgba(0,0,0,0.2)" }}>
                  <div style={{ marginRight:"0.8rem" }}>{idx+1}.</div>
                  <div className="avatar">{item.name?.charAt(0).toUpperCase()}</div>
                  <div style={{ marginLeft:"0.6rem" }}>
                    {item.name} — {metric==="km"
                      ? `${item.km.toFixed(2)} km`
                      : `${item.tempo.toFixed(2)} min/km`}
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="centered-title" style={{ marginTop:"2rem" }}>📊 Ostatní</h3>
            <ul style={{ listStyle:"none", padding:0 }}>
              {(view==="jednotlivci"?userList:teamList).slice(3).map((item, idx)=>(
                <li key={idx} className="tile" style={{ display:"flex", alignItems:"center" }}>
                  <div style={{ marginRight:"0.8rem" }}>{idx+4}.</div>
                  <div className="avatar">{item.name?.charAt(0).toUpperCase()}</div>
                  <div style={{ marginLeft:"0.6rem" }}>
                    {item.name} — {metric==="km"
                      ? `${item.km.toFixed(2)} km`
                      : `${item.tempo.toFixed(2)} min/km`}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}






