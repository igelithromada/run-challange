"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
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
import { Plus, DoorOpen, Trash2 } from "lucide-react";
import ActivityTypeSelector, { ActivityType, ActivityTypeIcon } from "../components/ActivityTypeSelector";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";

export default function TeamsPage() {

  const [menuVisible, setMenuVisible] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [challengeGoal, setChallengeGoal] = useState("500");
  const [challengeSaving, setChallengeSaving] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [teamIdsByType, setTeamIdsByType] = useState<Record<ActivityType, string | null>>({ běh: null, chůze: null });
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async u => {
      if (!u) {
        router.push("/login");
      } else {
        setUser(u);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const stored = data.teamIdsByType;
          const next: Record<ActivityType, string | null> = {
            běh: typeof stored?.běh === "string" ? stored.běh : (typeof data.teamId === "string" ? data.teamId : null),
            chůze: typeof stored?.chůze === "string" ? stored.chůze : null,
          };
          setTeamIdsByType(next);
        }
      }
    });
    return () => unsubAuth();
  }, [router]);

  const teamsQuery = useMemo(() => query(collection(db, "teams")), []);
  const teamsState = useSharedFirestoreQuery<any>("teams:all", teamsQuery);
  const teams = teamsState.data;
  const joinedTeam = teamIdsByType[selectedType];
  const currentTeam = teams.find((team: any) => team.id === joinedTeam);
  const isTeamOwner = !!currentTeam && currentTeam.createdBy === user?.uid;

  useEffect(() => {
    if (currentTeam) setChallengeGoal(String(Number(currentTeam.challengeGoalKm) || 500));
  }, [joinedTeam, currentTeam?.challengeGoalKm]);

  const createTeam = async () => {
    if (!teamName.trim() || !user) return;
    const newTeam = await addDoc(collection(db, "teams"), {
      name: teamName.trim(),
      type: selectedType,
      createdBy: user.uid,
      challengeGoalKm: Number(challengeGoal) > 0 ? Number(challengeGoal) : 500,
    });
    const next = { ...teamIdsByType, [selectedType]: newTeam.id };
    await setDoc(doc(db, "users", user.uid), {
      teamIdsByType: next,
      ...(selectedType === "běh" ? { teamId: newTeam.id, joinedTeam: newTeam.id } : {}),
    }, { merge: true });
    setTeamIdsByType(next);
    setTeamName("");
  };

  const saveChallengeGoal = async () => {
    const value = Number(challengeGoal.replace(",", "."));
    if (!joinedTeam || !isTeamOwner || !Number.isFinite(value) || value <= 0 || value > 100000) {
      setChallengeMessage("Zadej platný cíl od 0,1 do 100 000 km.");
      return;
    }
    setChallengeSaving(true);
    setChallengeMessage("");
    try {
      await setDoc(doc(db, "teams", joinedTeam), { challengeGoalKm: value }, { merge: true });
      setChallengeGoal(String(value));
      setChallengeMessage("Cíl týmové výzvy byl uložen.");
    } catch (error) {
      console.error("Nepodařilo se uložit cíl týmové výzvy", error);
      setChallengeMessage("Cíl se nepodařilo uložit. Zkus to znovu.");
    } finally { setChallengeSaving(false); }
  };

  const joinTeam = async (teamId: string) => {
    const next = { ...teamIdsByType, [selectedType]: teamId };
    setTeamIdsByType(next);
    if (user) {
      await setDoc(doc(db, "users", user.uid), {
        teamIdsByType: next,
        ...(selectedType === "běh" ? { teamId, joinedTeam: teamId } : {}),
      }, { merge: true });
    }
  };

  const leaveTeam = async () => {
    const next = { ...teamIdsByType, [selectedType]: null };
    setTeamIdsByType(next);
    if (user) {
      await setDoc(doc(db, "users", user.uid), {
        teamIdsByType: next,
        ...(selectedType === "běh" ? { teamId: null, joinedTeam: null } : {}),
      }, { merge: true });
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!window.confirm("Opravdu chceš tento tým smazat?")) return;
    await deleteDoc(doc(db, "teams", teamId));
    if (joinedTeam === teamId) {
      const next = { ...teamIdsByType, [selectedType]: null };
      setTeamIdsByType(next);
      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          teamIdsByType: next,
          ...(selectedType === "běh" ? { teamId: null, joinedTeam: null } : {}),
        }, { merge: true });
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
    else if (item === "progress") router.push("/progress");
    else if (item === "weather") router.push("/weather");
    else if (item === "admin") router.push("/admin");
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
          <div className="control-caption">Tým pro aktivitu</div>
          <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Aktivita týmu" />
          <div className="teams-section-heading"><div><h2>Vytvořit nový tým</h2><p>Založ tým a pozvi ostatní členy.</p></div></div>
          <div className="teams-create-form">
            <input type="text" placeholder="Zadej název týmu" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button onClick={createTeam} className="tile-button teams-primary-button" disabled={!teamName.trim()}><Plus size={18} /> Vytvořit tým</button>
          </div>
        </section>

        {joinedTeam && currentTeam && (
          <section className="tile teams-challenge-settings">
            <div><h2>Měsíční týmová výzva</h2><p>Nastavte si společný cíl v kilometrech. Výsledek se zobrazí v Mém progresu.</p></div>
            {isTeamOwner ? (
              <div className="teams-challenge-form">
                <label>Cílová vzdálenost (km)<input type="number" min="0.1" max="100000" step="1" value={challengeGoal} onChange={e => setChallengeGoal(e.target.value)} /></label>
                <button className="tile-button teams-primary-button" onClick={saveChallengeGoal} disabled={challengeSaving}>{challengeSaving ? "Ukládám…" : "Uložit cíl"}</button>
              </div>
            ) : <p className="teams-challenge-current">Aktuální cíl: <strong>{Number(currentTeam.challengeGoalKm) || 500} km</strong>. Měnit ho může zakladatel týmu.</p>}
            {challengeMessage && <small className="teams-challenge-message" role="status">{challengeMessage}</small>}
          </section>
        )}

        <section className="teams-list-section">
          <div className="teams-list-heading"><h2>Dostupné týmy</h2><span className="teams-count">{teams.length}</span></div>
          <div className="teams-grid">
            {teams.map((team) => {
              const teamType: ActivityType = team.type === "chůze" ? "chůze" : "běh";
              const isJoined = joinedTeam === team.id;
              return (
              <article key={team.id} className={isJoined ? "tile team-card team-card-joined" : "tile team-card"}>
                <div className="team-card-top">
                  <div className="team-avatar">{(team.name || "T").charAt(0).toUpperCase()}</div>
                  <span className="team-type-badge"><ActivityTypeIcon type={teamType} size={16} /> {teamType === "chůze" ? "Chůze" : "Běh"}</span>
                  {isJoined && <span className="team-member-label">Tvůj tým</span>}
                </div>
                <h3>{team.name}</h3>
                <div className="team-card-actions">
                  {isJoined ? (
                    <button onClick={leaveTeam} className="tile-button team-action-button"><DoorOpen size={18} /> Odejít z týmu</button>
                  ) : (
                    <button onClick={() => joinTeam(team.id)} className="tile-button team-action-button"><Plus size={18} /> Přidat se</button>
                  )}
                  {user?.uid === team.createdBy && <button onClick={() => deleteTeam(team.id)} className="tile-button team-delete-button" title="Smazat tým" aria-label="Smazat tým"><Trash2 size={18} /></button>}
                </div>
              </article>
              );
            })}
            {teams.length === 0 && <div className="tile teams-empty"><div className="teams-empty-icon">👟</div><strong>Zatím tu nejsou žádné týmy</strong><p>Buď první a založ vlastní tým.</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
