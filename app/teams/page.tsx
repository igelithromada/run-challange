"use client";
import React, { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [teamName, setTeamName] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState("km");
  const [userId, setUserId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [joinedTeamId, setJoinedTeamId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserId(user.uid);
      }
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRuns = onSnapshot(collection(db, "runs"), (snapshot) => {
      setRuns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Načti tým z localStorage hned při načtení
    setJoinedTeamId(localStorage.getItem("joinedTeam"));

    return () => {
      unsubscribeAuth();
      unsubTeams();
      unsubRuns();
    };
  }, []);

  const createTeam = async () => {
    if (teamName.trim() === "" || !userId) return;
    try {
      await addDoc(collection(db, "teams"), { name: teamName, owner: userId });
      setTeamName("");
    } catch (err) {
      console.error("Chyba při vytváření týmu: ", err);
    }
  };

  const joinTeam = (teamId) => {
    localStorage.setItem("joinedTeam", teamId);
    setJoinedTeamId(teamId);
    alert("Připojil ses k týmu. Nové aktivity budou uloženy pod tímto týmem.");
  };

  const editTeam = async (team) => {
    const newName = prompt("Zadej nový název týmu:", team.name);
    if (newName) {
      await updateDoc(doc(db, "teams", team.id), { name: newName });
    }
  };

  const deleteTeam = async (team) => {
    if (team.owner !== userId) {
      alert("Tento tým může smazat pouze jeho zakladatel.");
      return;
    }
    if (confirm(`Opravdu chceš smazat tým "${team.name}"?`)) {
      await deleteDoc(doc(db, "teams", team.id));
    }
  };

  const teamStats = teams.map(team => {
    const teamRuns = runs.filter(run => run.teamId === team.id);
    const totalKm = teamRuns.reduce<any | null>((sum, run) => sum + (run.km || 0), 0);
    const totalMin = teamRuns.reduce<any | null>((sum, run) => sum + (run.minuty || 0), 0);
    const tempo = totalKm ? (totalMin / totalKm).toFixed(2) : "0";
    return { team, totalKm, totalMin, tempo };
  });

  const sortedTeams = [...teamStats].sort((a, b) => {
    if (selectedMetric === "km") return b.totalKm - a.totalKm;
    if (selectedMetric === "cas") return b.totalMin - a.totalMin;
    if (selectedMetric === "tempo") return parseFloat(a.tempo) - parseFloat(b.tempo);
    return 0;
  });

  const getBgColor = (index) => {
    if (index === 0) return "#ffd700";
    if (index === 1) return "#c0c0c0";
    if (index === 2) return "#cd7f32";
    return "#f9f9f9";
  };

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Týmy</h1>

      <button 
        onClick={() => setShowManage(!showManage)}
        style={{ 
          padding: "8px 16px", 
          backgroundColor: "blue", 
          color: "white", 
          border: "none", 
          borderRadius: "5px", 
          marginBottom: "2rem" 
        }}>
        Přidat se do týmu
      </button>

      {!showManage && (
        <>
          <div style={{ marginBottom: "1rem" }}>
            {["km", "cas", "tempo"].map(metric => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                style={{
                  backgroundColor: selectedMetric === metric ? "orange" : "white",
                  border: "1px solid black",
                  padding: "8px 16px",
                  marginRight: "5px"
                }}
              >
                {metric === "km" && "Km"}
                {metric === "cas" && "Čas"}
                {metric === "tempo" && "Tempo"}
              </button>
            ))}
          </div>

          <ul style={{ listStyle: "none", padding: 0, maxWidth: "600px", margin: "0 auto" }}>
            {sortedTeams.map((t, index) => (
              <li key={t.team.id} style={{
                backgroundColor: getBgColor(index),
                padding: "10px",
                marginBottom: "8px",
                borderRadius: "8px",
                border: "1px solid #ddd"
              }}>
                <strong>{index + 1}.</strong> {t.team.name} — 
                {selectedMetric === "km" && ` ${t.totalKm.toFixed(2)} km`}
                {selectedMetric === "cas" && ` ${(t.totalMin/60).toFixed(2)} h`}
                {selectedMetric === "tempo" && ` ${t.tempo} min/km`}
              </li>
            ))}
          </ul>
        </>
      )}

      {showManage && (
        <div style={{ marginTop: "2rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <input 
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Název týmu"
              style={{ padding: "5px", marginRight: "5px" }}
            />
            <button 
              onClick={createTeam} 
              style={{ 
                padding: "6px 12px", 
                backgroundColor: "green", 
                color: "white", 
                border: "none", 
                borderRadius: "5px" 
              }}>
              Vytvořit tým
            </button>
          </div>

          {teams.map(team => (
            <div key={team.id} style={{ margin: "0.5rem 0" }}>
              <strong>{team.name}</strong>{" "}
              {joinedTeamId === team.id 
                ? <span style={{ color: "green" }}>✓ Jsi v tomto týmu</span> 
                : <button onClick={() => joinTeam(team.id)}>➕ Přidat se</button>}
              <button onClick={() => editTeam(team)} style={{ marginLeft: "5px" }}>✏️ Upravit</button>
              {team.owner === userId && (
                <button onClick={() => deleteTeam(team)} style={{ marginLeft: "5px", color: "red" }}>🗑 Smazat</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}