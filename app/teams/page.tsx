"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { Plus, DoorOpen, Trash2 } from "lucide-react";

export default function TeamsPage() {
  useThemeLoader();

  const [menuVisible, setMenuVisible] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [joinedTeam, setJoinedTeam] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
      } else {
        setUser(u);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.joinedTeam) setJoinedTeam(data.joinedTeam);
        }
      }
    });

    const q = query(collection(db, "teams"));
    const unsubTeams = onSnapshot(q, (snap) => {
      setTeams(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
    await setDoc(doc(db, "users", user.uid), { joinedTeam: newTeam.id }, { merge: true });
    setJoinedTeam(newTeam.id);
    setTeamName("");
  };

  const joinTeam = async (teamId: string) => {
    setJoinedTeam(teamId);
    if (user) {
      await setDoc(doc(db, "users", user.uid), { joinedTeam: teamId }, { merge: true });
    }
  };

  const leaveTeam = async () => {
    setJoinedTeam(null);
    if (user) {
      await setDoc(doc(db, "users", user.uid), { joinedTeam: null }, { merge: true });
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!window.confirm("Opravdu chceš tento tým smazat?")) return;
    await deleteDoc(doc(db, "teams", teamId));
    if (joinedTeam === teamId) {
      setJoinedTeam(null);
      if (user) {
        await setDoc(doc(db, "users", user.uid), { joinedTeam: null }, { merge: true });
      }
    }
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
            🏅 Jsi členem týmu: {teams.find((t) => t.id === joinedTeam)?.name || "?"}
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
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={createTeam}
            className="tile-button"
            style={{ width: "100%", marginTop: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
          >
            <Plus size={18} /> Vytvořit
          </button>
        </div>

        <h3 className="centered-title" style={{ marginTop: "2rem" }}>Dostupné týmy</h3>
        <div className="list-container" style={{ gap: "0.5rem" }}>
          {teams.map((team) => (
            <div key={team.id} className="tile list-tile">
              <div className="tile-content" style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                {team.name}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {joinedTeam === team.id ? (
                  <button
                    onClick={leaveTeam}
                    className="tile-button"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <DoorOpen size={18} /> Odejít
                  </button>
                ) : (
                  <button
                    onClick={() => joinTeam(team.id)}
                    className="tile-button"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <Plus size={18} /> Přidat se
                  </button>
                )}
                {user?.uid === team.createdBy && (
                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="tile-button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.4rem",
                      width: "2.5rem",
                      minWidth: "2.5rem",
                    }}
                    title="Smazat tým"
                  >
                    <Trash2 size={18} />
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
