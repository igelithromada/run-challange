"use client";
import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, addDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";

export default function TeamsPage() {
  useThemeLoader();

  const [menuVisible, setMenuVisible] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [joinedTeam, setJoinedTeam] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else {
        setUser(u);
        const localTeam = localStorage.getItem("joinedTeam");
        if (localTeam) setJoinedTeam(localTeam);
      }
    });

    const q = query(collection(db, "teams"));
    const unsubTeams = onSnapshot(q, (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubAuth(); unsubTeams(); }
  }, [router]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    const newTeam = await addDoc(collection(db, "teams"), { name: teamName.trim() });
    localStorage.setItem("joinedTeam", newTeam.id);
    setJoinedTeam(newTeam.id);
    setTeamName("");
  };

  const joinTeam = (teamId: string) => {
    localStorage.setItem("joinedTeam", teamId);
    setJoinedTeam(teamId);
  };

  const leaveTeam = () => {
    localStorage.removeItem("joinedTeam");
    setJoinedTeam(null);
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (err) {
        console.error("Chyba při odhlašování: ", err);
      }
    } else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Týmy</h1>

        {joinedTeam && (
          <div className="tile" style={{ marginBottom: "1.5rem", textAlign: "center" }}>
            🏅 Jsi členem týmu: {teams.find(t => t.id === joinedTeam)?.name || "?"}
          </div>
        )}

        <div className="tile">
          <h3>Vytvořit tým</h3>
          <input
            type="text"
            placeholder="Název týmu"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "8px",
              border: "none",
              marginTop: "0.5rem",
              boxSizing: "border-box"
            }}
          />
          <button
            onClick={createTeam}
            className="tile-button"
            style={{
              width: "100%",
              marginTop: "0.5rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.3rem"
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>➕</span> Vytvořit
          </button>
        </div>

        <h3 className="centered-title" style={{ marginTop: "2rem" }}>Dostupné týmy</h3>
        <div className="list-container" style={{ gap: "0.5rem" }}>
          {teams.map(team => (
            <div key={team.id} className="tile list-tile" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="tile-content">
                <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{team.name}</div>
              </div>
              {joinedTeam === team.id ? (
                <button
                  onClick={leaveTeam}
                  className="tile-button"
                  style={{
                    width: "100px",
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.3rem",
                    background: "rgba(255,0,0,0.3)"
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>🚪</span> Odejít
                </button>
              ) : (
                <button
                  onClick={() => joinTeam(team.id)}
                  className="tile-button"
                  style={{
                    width: "100px",
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>➕</span> Přidat se
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
