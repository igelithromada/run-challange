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
          const activeTeamId = data.teamId || data.joinedTeam;
          if (activeTeamId) setJoinedTeam(activeTeamId);
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
    await setDoc(doc(db, "users", user.uid), {
      teamId: newTeam.id,
      joinedTeam: newTeam.id,
    }, { merge: true });
    setJoinedTeam(newTeam.id);
    setTeamName("");
  };

  const joinTeam = async (teamId: string) => {
    setJoinedTeam(teamId);
    if (user) {
      await setDoc(doc(db, "users", user.uid), {
        teamId,
        joinedTeam: teamId,
      }, { merge: true });
    }
  };

  const leaveTeam = async () => {
    setJoinedTeam(null);
    if (user) {
      await setDoc(doc(db, "users", user.uid), { teamId: null, joinedTeam: null }, { merge: true });
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!window.confirm("Opravdu chceš tento tým smazat?")) return;
    await deleteDoc(doc(db, "teams", teamId));
    if (joinedTeam === teamId) {
      setJoinedTeam(null);
      if (user) {
        await setDoc(doc(db, "users", user.uid), { teamId: null, joinedTeam: null }, { merge: true });
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
    } else if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
  };

  return (
    <>
      <Navbar title="Týmy" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container teams-page">
        <header className="teams-header"><span className="teams-eyebrow">SPOLEČNĚ ZA POHYBEM</span><h1>Týmy</h1><p>Vytvoř vlastní tým nebo se přidej k ostatním z Dolní Lhoty.</p></header>

        {joinedTeam && (
          <div className="tile teams-current">
            <div className="teams-current-icon">🏅</div>
            <div><small>TVŮJ AKTUÁLNÍ TÝM</small><strong>{teams.find((t) => t.id === joinedTeam)?.name || "?"}</strong></div>
          </div>
        )}

        <section className="tile teams-create">
          <div className="teams-section-heading"><div><h2>Vytvořit nový tým</h2><p>Založ tým a pozvi ostatní běžce.</p></div></div>
          <div className="teams-create-form">
            <input type="text" placeholder="Zadej název týmu" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button onClick={createTeam} className="tile-button teams-primary-button" disabled={!teamName.trim()}><Plus size={18} /> Vytvořit tým</button>
          </div>
        </section>

        <section className="teams-list-section">
          <div className="teams-list-heading"><h2>Dostupné týmy</h2><span className="teams-count">{teams.length}</span></div>
          <div className="teams-grid">
            {teams.map((team) => (
              <article key={team.id} className={joinedTeam === team.id ? "tile team-card team-card-joined" : "tile team-card"}>
                <div className="team-card-top">
                  <div className="team-avatar">{(team.name || "T").charAt(0).toUpperCase()}</div>
                  {joinedTeam === team.id && <span className="team-member-label">Tvůj tým</span>}
                </div>
                <h3>{team.name}</h3>
                <div className="team-card-actions">
                  {joinedTeam === team.id ? (
                    <button onClick={leaveTeam} className="tile-button team-action-button"><DoorOpen size={18} /> Odejít z týmu</button>
                  ) : (
                    <button onClick={() => joinTeam(team.id)} className="tile-button team-action-button"><Plus size={18} /> Přidat se</button>
                  )}
                  {user?.uid === team.createdBy && <button onClick={() => deleteTeam(team.id)} className="tile-button team-delete-button" title="Smazat tým" aria-label="Smazat tým"><Trash2 size={18} /></button>}
                </div>
              </article>
            ))}
            {teams.length === 0 && <div className="tile teams-empty"><div className="teams-empty-icon">👟</div><strong>Zatím tu nejsou žádné týmy</strong><p>Buď první a založ vlastní tým.</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
