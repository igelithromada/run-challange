"use client";
import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
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

    return () => {
      unsubAuth();
      unsubTeams();
    };
  }, [router]);

  const createTeam = async () => {
    if (!teamName.trim() || !user) return;
    const newTeam = await addDoc(collection(db, "teams"), {
      name: teamName.trim(),
      createdBy: user.uid,
    });
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

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Opravdu chceš smazat tento tým?")) return;
    await deleteDoc(doc(db, "teams", teamId));
    if (joinedTeam === teamId) leaveTeam();
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
          <div className="tile" style={{ marginBottom: "1rem", textAlign: "center" }}>
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
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            ➕ Vytvořit
          </button>
        </div>

        <h3 className="centered-title" style={{ marginTop: "2rem" }}>Dostupné týmy</h3>
        <div className="list-container" style={{ gap: "0.5rem" }}>
          {teams.map(team => (
            <div key={team.id} className="tile list-tile" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{team.name}</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {joinedTeam === team.id ? (
                  <button
                    onClick={leaveTeam}
                    className="tile-button"
                    style={{
                      background: "rgba(255,0,0,0.3)",
                      minWidth: "90px",
                      padding: "0.4rem 0.7rem",
                      display: "flex",
                      justifyContent: "center"
                    }}
                  >
                    🚪 Odejít
                  </button>
                ) : (
                  <button
                    onClick={() => joinTeam(team.id)}
                    className="tile-button"
                    style={{
                      minWidth: "90px",
                      padding: "0.4rem 0.7rem",
                      display: "flex",
                      justifyContent: "center"
                    }}
                  >
                    ➕ Přidat se
                  </button>
                )}
                {user?.uid === team.createdBy && (
                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="tile-button"
                    style={{
                      background: "rgba(255,0,0,0.15)",
                      padding: "0.4rem 0.7rem",
                      display: "flex",
                      justifyContent: "center"
                    }}
                    title="Smazat tým"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
