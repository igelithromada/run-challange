"use client";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Bar } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";
Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function StatisticsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [view, setView] = useState("já"); // já, jednotlivci, týmy
  const [metric, setMetric] = useState("km");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    const q = query(collection(db, "runs"), orderBy("timestamp", "desc"));
    const unsubRuns = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRuns(data);
    });
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubAuth(); unsubRuns(); unsubTeams(); }
  }, [router]);

  // filtr na datum a typ
  const filtered = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = run.timestamp?.seconds ? new Date(run.timestamp.seconds*1000) : new Date(run.timestamp);
    if (startDate && new Date(startDate) > date) return false;
    if (endDate && new Date(endDate+"T23:59") < date) return false;
    return true;
  });

  // data podle view
  let currentData = [];
  if (view === "já") {
    currentData = filtered.filter(r => r.uid === user?.uid);
  } else if (view === "jednotlivci") {
    currentData = filtered;
  } else if (view === "týmy") {
    currentData = filtered.filter(r => r.teamId);
  }

  // součty
  const totalKm = currentData.reduce<any | null>((a,b)=>a+Number(b.km||0),0);
  const totalMin = currentData.reduce<any | null>((a,b)=>a+Number(b.minuty||0),0);
  const totalH = totalMin/60;
  const avgTempo = totalKm ? (totalMin/totalKm).toFixed(2): 0;

  // pro graf a TOP
  let chartLabels=[], chartData=[], topItems=[];
  if (view==="já") {
    const myName = currentData[0]?.nickname || currentData[0]?.email?.split("@")[0] || "Já";
    chartLabels=[myName];
    chartData=[metric==="km"?totalKm:metric==="čas"?totalH:avgTempo];
  } 
  else if (view==="jednotlivci") {
    const userMap = {};
    filtered.forEach(run=>{
      const name = run.nickname || run.email?.split("@")[0] || "Anonym";
      if (!userMap[name]) userMap[name]={km:0,min:0};
      userMap[name].km+=Number(run.km||0);
      userMap[name].min+=Number(run.minuty||0);
    });
    const list = Object.entries(userMap).map(([name,data])=>({
      name,
      km:data.km,
      čas:data.min/60,
      tempo:data.km ? (data.min/data.km):0
    }));
    list.sort((a,b)=>b[metric]-a[metric]);
    chartLabels=list.map(u=>u.name);
    chartData=list.map(u=>u[metric]);
    topItems=list.slice(0,10);
  }
  else if (view==="týmy") {
    const teamMap = {};
    filtered.forEach(run=>{
      const team = teams.find(t=>t.id===run.teamId)?.name || "?";
      if (!teamMap[team]) teamMap[team]={km:0,min:0};
      teamMap[team].km+=Number(run.km||0);
      teamMap[team].min+=Number(run.minuty||0);
    });
    const list = Object.entries(teamMap).map(([team,data])=>({
      team,
      km:data.km,
      čas:data.min/60,
      tempo:data.km?(data.min/data.km):0
    }));
    list.sort((a,b)=>b[metric]-a[metric]);
    chartLabels=list.map(t=>t.team);
    chartData=list.map(t=>t[metric]);
    topItems=list.slice(0,10);
  }

  // moje pořadí
  let myPos=null, myTeamPos=null, myTeamName=null,myTeamPosInTeam=null;
  if(view==="já"){
    // mezi jednotlivci
    const userMap = {};
    filtered.forEach(run=>{
      const name = run.nickname || run.email?.split("@")[0] || "Anonym";
      if (!userMap[name]) userMap[name]={km:0,min:0};
      userMap[name].km+=Number(run.km||0);
      userMap[name].min+=Number(run.minuty||0);
    });
    const list = Object.entries(userMap).map(([name,data])=>({
      name, km:data.km, čas:data.min/60, tempo:data.km?(data.min/data.km):0
    }));
    list.sort((a,b)=>b[metric]-a[metric]);
    const myName = currentData[0]?.nickname || currentData[0]?.email?.split("@")[0] || "Já";
    myPos = list.findIndex(x=>x.name===myName)+1;

    // tým
    myTeamName = currentData.find(r=>r.teamId)?.teamName || 
                 teams.find(t=>t.id===currentData.find(r=>r.teamId)?.teamId)?.name;
    if(myTeamName){
      const teamMap = {};
      filtered.forEach(run=>{
        const team = teams.find(t=>t.id===run.teamId)?.name || "?";
        if (!teamMap[team]) teamMap[team]={km:0,min:0};
        teamMap[team].km+=Number(run.km||0);
        teamMap[team].min+=Number(run.minuty||0);
      });
      const tList=Object.entries(teamMap).map(([team,data])=>({
        team, km:data.km, čas:data.min/60, tempo:data.km?(data.min/data.km):0
      }));
      tList.sort((a,b)=>b[metric]-a[metric]);
      myTeamPos=tList.findIndex(t=>t.team===myTeamName)+1;

      // uvnitř týmu
      const inside = filtered.filter(r=>(teams.find(t=>t.id===r.teamId)?.name)===myTeamName);
      const insideMap = {};
      inside.forEach(run=>{
        const name = run.nickname || run.email?.split("@")[0] || "Anonym";
        if (!insideMap[name]) insideMap[name]={km:0,min:0};
        insideMap[name].km+=Number(run.km||0);
        insideMap[name].min+=Number(run.minuty||0);
      });
      const insideList = Object.entries(insideMap).map(([name,data])=>({
        name, km:data.km, čas:data.min/60, tempo:data.km?(data.min/data.km):0
      }));
      insideList.sort((a,b)=>b[metric]-a[metric]);
      myTeamPosInTeam = insideList.findIndex(x=>x.name===myName)+1;
    }
  }

  return (
    <>
      <Navbar onMenuClick={()=>setMenuVisible(true)} />
      <Sidebar visible={menuVisible} onClose={()=>setMenuVisible(false)} onSelect={(item)=>{
        setMenuVisible(false);
        if(item==="statistics") router.push("/statistics");
      }} />
      <div style={{ textAlign:"center", marginTop:"2rem" }}>
        <h1>Statistiky</h1>
        <div style={{margin:"0.5rem"}}>
          <button onClick={()=>setSelectedType("běh")} style={{background:selectedType==="běh"?"orange":"white"}}>Běh</button>
          <button onClick={()=>setSelectedType("chůze")} style={{background:selectedType==="chůze"?"orange":"white"}}>Chůze</button>
        </div>
        <div style={{margin:"0.5rem"}}>
          <button onClick={()=>setView("já")} style={{background:view==="já"?"orange":"white"}}>Já</button>
          <button onClick={()=>setView("jednotlivci")} style={{background:view==="jednotlivci"?"orange":"white"}}>Jednotlivci</button>
          <button onClick={()=>setView("týmy")} style={{background:view==="týmy"?"orange":"white"}}>Týmy</button>
        </div>
        <div style={{margin:"0.5rem"}}>
          <button onClick={()=>setMetric("km")} style={{background:metric==="km"?"orange":"white"}}>Km</button>
          <button onClick={()=>setMetric("čas")} style={{background:metric==="čas"?"orange":"white"}}>Čas</button>
          <button onClick={()=>setMetric("tempo")} style={{background:metric==="tempo"?"orange":"white"}}>Tempo</button>
        </div>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/> 
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} style={{marginLeft:"0.5rem"}}/>
        <div style={{margin:"1rem"}}>
          <button onClick={()=>router.push("/")} style={{background:"#f0ad4e", color:"white", padding:"0.5rem 1rem", border:"none"}}>← Zpět na hlavní stránku</button>
        </div>

        <div style={{ display:"flex", justifyContent:"center", gap:"0.5rem", flexWrap:"wrap", marginBottom:"1rem"}}>
          <div style={{ border:"1px solid #ccc", padding:"0.5rem", minWidth:"90px" }}>Celkem km:<br/>{totalKm.toFixed(2)}</div>
          <div style={{ border:"1px solid #ccc", padding:"0.5rem", minWidth:"90px" }}>Celkem čas:<br/>{totalH.toFixed(2)} h</div>
          <div style={{ border:"1px solid #ccc", padding:"0.5rem", minWidth:"90px" }}>Průměrné tempo:<br/>{avgTempo} min/km</div>
          <div style={{ border:"1px solid #ccc", padding:"0.5rem", minWidth:"90px" }}>Počet:<br/>{currentData.length}</div>
        </div>

        {view==="já" && (
          <>
            <div>{myPos && <p>Tvá pozice mezi jednotlivci: {myPos}.</p>}</div>
            {myTeamName && <div><p>Tvůj tým {myTeamName} je {myTeamPos}.</p>
            {myTeamPosInTeam && <p>Ve svém týmu jsi {myTeamPosInTeam}.</p>}</div>}
          </>
        )}

        {topItems.length>0 && (view==="jednotlivci"||view==="týmy") && (
          <>
            <h3>TOP {view}</h3>
            <ul style={{listStyle:"none", padding:0}}>
              {topItems.map((item, idx)=>(
                <li key={idx} style={{background:idx===0?"gold":idx===1?"silver":idx===2?"#cd7f32":"#eee", margin:"0.2rem", padding:"0.5rem"}}>
                  {idx+1}. 🏃 <span style={{color:"blue", cursor:"pointer"}}>{item.name||item.team}</span> — 
                  {metric==="km"?` ${item.km.toFixed(2)} km`:
                  metric==="čas"?` ${item.čas.toFixed(2)} h`:
                  ` ${item.tempo.toFixed(2)} min/km`}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Graf - {view} podle {metric}</h3>
        <div style={{maxWidth:"600px", margin:"0 auto"}}>
          <Bar data={{
            labels:chartLabels,
            datasets:[{label:metric==="km"?"Km":metric==="čas"?"H":"Min/km", data:chartData, backgroundColor:"orange"}]
          }} />
        </div>
      </div>
    </>
  );
}