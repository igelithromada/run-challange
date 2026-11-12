"use client";

import React, { useEffect, useMemo, useState } from "react";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, ChevronRight, Pencil, Check } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType, ActivityTypeIcon } from "../components/ActivityTypeSelector";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { showAppToast } from "../components/AppToast";
import type { TeamData as Team } from "../types";
import { allTeamsQuery } from "../lib/services/teams";
import { getUserProfile } from "../lib/services/users";

type TeamMutationResponse = {
  team?: { id?: string };
  teamIdsByType?: Partial<Record<ActivityType, string | null>>;
  error?: string;
};

export default function TeamsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  const [teamIdsByType, setTeamIdsByType] = useState<Record<ActivityType, string | null>>({ běh: null, chůze: null });
  const [user, setUser] = useState<User | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser) {
        if (active) router.push("/login");
        return;
      }

      if (active) setUser(currentUser);

      try {
        const data = await getUserProfile(currentUser.uid);
        if (!active || !data) return;

        const stored = data.teamIdsByType || {};
        setTeamIdsByType({
          běh: typeof stored.běh === "string" ? stored.běh : typeof data.teamId === "string" ? data.teamId : null,
          chůze: typeof stored.chůze === "string" ? stored.chůze : null,
        });
      } catch (error) {
        if (active) console.error("Nepodařilo se načíst týmové nastavení uživatele", error);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const teamsQuery = useMemo(() => allTeamsQuery(), []);
  const teamsState = useSharedFirestoreQuery<Team>("teams:all", teamsQuery);
  const teams = teamsState.data;
  const visibleTeams = teams.filter(team => (team.type === "chůze" ? "chůze" : "běh") === selectedType);
  const joinedTeamId = teamIdsByType[selectedType];
  const isActuallyJoined = (team: Team) =>
    !!user && Array.isArray(team.memberIds) && team.memberIds.includes(user.uid);
  const joinedTeam = visibleTeams.find(isActuallyJoined) || teams.find(team => team.id === joinedTeamId && isActuallyJoined(team));

  const teamRequest = async (action: string, payload: Record<string, unknown> = {}): Promise<TeamMutationResponse> => {
    if (!auth.currentUser) throw new Error("Nejsi přihlášen.");

    const token = await auth.currentUser.getIdToken(true);
    const response = await fetch("/api/teams/manage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    const result = (await response.json().catch(() => ({}))) as TeamMutationResponse;
    if (!response.ok) throw new Error(result.error || "Operaci se nepodařilo dokončit.");
    return result;
  };

  const createTeam = async () => {
    if (!teamName.trim() || !user) return;

    try {
      const result = await teamRequest("create", { name: teamName.trim(), type: selectedType });
      const id = result.team?.id;
      if (id) {
        setTeamName("");
        showAppToast("Tým byl vytvořen.", "success");
        router.push("/teams");
      }
    } catch (error) {
      console.error(error);
      showAppToast(error instanceof Error ? error.message : "Tým se nepodařilo vytvořit.", "error");
    }
  };

  const joinTeam = async (team: Team) => {
    try {
      const result = await teamRequest("join", { teamId: team.id });
      const next = result.teamIdsByType || {};
      setTeamIdsByType({ běh: next.běh ?? teamIdsByType.běh, chůze: next.chůze ?? teamIdsByType.chůze });
      showAppToast("Přidal ses do týmu.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Do týmu se nepodařilo přidat.", "error");
    }
  };

  const leaveTeam = async (teamId: string) => {
    if (!teamId || !user) return;

    try {
      const result = await teamRequest("leave", { teamId });
      const next = result.teamIdsByType || {};
      setTeamIdsByType({ běh: next.běh ?? teamIdsByType.běh, chůze: next.chůze ?? teamIdsByType.chůze });
      showAppToast("Z týmu ses odhlásil.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Z týmu se nepodařilo odejít.", "error");
    }
  };

  const startEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name || "");
  };

  const saveTeamName = async (team: Team) => {
    const name = editingTeamName.trim().slice(0, 60);
    if (!name || !user || team.createdBy !== user.uid) return;

    try {
      await teamRequest("rename", { teamId: team.id, name });
      setEditingTeamId(null);
      setEditingTeamName("");
      showAppToast("Název týmu byl uložen.");
    } catch (error) {
      console.error(error);
      showAppToast(error instanceof Error ? error.message : "Název týmu se nepodařilo uložit.", "error");
    }
  };

  const deleteTeam = async (team: Team) => {
    if (team.createdBy !== user?.uid || !window.confirm("Opravdu chceš tento tým smazat?")) return;

    try {
      await teamRequest("delete", { teamId: team.id });
      if (joinedTeam?.id === team.id) {
        setTeamIdsByType(current => ({ ...current, [selectedType]: null }));
      }
      showAppToast("Tým byl smazán.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Tým se nepodařilo smazat.", "error");
    }
  };

  useEffect(() => {
    if (teamsState.error) showAppToast("Týmy se nepodařilo načíst. Zkus stránku obnovit.", "error");
  }, [teamsState.error]);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
      return;
    }

    const routes: Record<string, string> = {
      home: "/",
      myrun: "/myruns",
      teams: "/teams",
      settings: "/settings",
      statistics: "/statistics",
      participants: "/participants",
      progress: "/progress",
      trainer: "/trainer",
      weather: "/weather",
      admin: "/admin",
    };

    router.push(routes[item] || "/");
  };

  return (
    <>
      <Navbar title="Týmy" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <main className="container teams-page">
        <header className="teams-header">
          <span className="teams-eyebrow">SPOLEČNĚ ZA POHYBEM</span>
          <h1>Týmy</h1>
          <p>Vyber si tým podle aktivity. Každý tým má vlastní nastavení, cíl a seznam účastníků.</p>
        </header>

        <section className="tile teams-create">
          <div className="control-caption">Aktivita týmů</div>
          <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Aktivita týmů" />
          <div className="teams-section-heading">
            <div>
              <h2>Vytvořit nový tým</h2>
              <p>Nový tým bude automaticky určený pro {selectedType}.</p>
            </div>
          </div>
          <div className="teams-create-form">
            <input
              type="text"
              placeholder="Zadej název týmu"
              value={teamName}
              onChange={event => setTeamName(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") void createTeam();
              }}
            />
            <button onClick={() => void createTeam()} className="run-primary-button" disabled={!teamName.trim()}>
              <Plus size={18} /> Vytvořit tým
            </button>
          </div>
        </section>

        <div className="teams-list-heading">
          <div>
            <h2>{selectedType === "běh" ? "Běžecké" : "Chodecké"} týmy</h2>
            <p>{visibleTeams.length} {visibleTeams.length === 1 ? "tým" : "týmů"}</p>
          </div>
          {joinedTeam && (
            <button className="tile-button team-current-button" onClick={() => router.push("/teams/" + joinedTeam.id)}>
              <Users size={17} /> Můj tým
            </button>
          )}
        </div>

        {teamsState.loading ? (
          <LoadingSkeleton count={3} />
        ) : teamsState.error ? (
          <div className="tile teams-empty">
            <strong>Týmy se nepodařilo načíst</strong>
            <p>Zkus stránku obnovit. Pokud problém přetrvá, zkontroluj připojení.</p>
          </div>
        ) : (
        <section className="teams-grid">
          {visibleTeams.map(team => {
            const isJoined = isActuallyJoined(team);


            return (
              <article
                key={team.id}
                className={`tile team-card ${isJoined ? "team-card-joined" : ""}`}
                onClick={() => router.push("/teams/" + team.id)}
              >
                <div className="team-card-main">
                  <div className="team-avatar">
                    {team.avatarUrl ? <img src={cloudinaryImageUrl(team.avatarUrl, 96)} alt="" /> : <Users size={22} />}
                  </div>

                  <div className="team-card-info">
                    {editingTeamId === team.id ? (
                      <div className="team-edit-name" onClick={event => event.stopPropagation()}>
                        <input
                          value={editingTeamName}
                          maxLength={60}
                          autoFocus
                          onChange={event => setEditingTeamName(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Enter") void saveTeamName(team);
                            if (event.key === "Escape") {
                              setEditingTeamId(null);
                              setEditingTeamName("");
                            }
                          }}
                        />
                        <button type="button" className="run-primary-button team-edit-save-button" onClick={() => void saveTeamName(team)}>
                          <Check size={17} /> Uložit
                        </button>
                        <button
                          type="button"
                          className="run-secondary-button team-edit-cancel-button"
                          onClick={() => {
                            setEditingTeamId(null);
                            setEditingTeamName("");
                          }}
                        >
                          Zrušit
                        </button>
                      </div>
                    ) : (
                      <div className="team-card-title-row">
                        <h3>{team.name}</h3>
                        {isJoined && <span className="team-member-label">Tvůj tým</span>}
                      </div>
                    )}

                    <div className="team-card-sub">
                      <span className="team-type-badge">
                        <ActivityTypeIcon type={selectedType} size={15} /> {selectedType === "běh" ? "Běh" : "Chůze"}
                      </span>
                      <span>{Number(team.challengeGoalKm) || 500} km / měsíc</span>
                    </div>
                  </div>

                  {editingTeamId !== team.id && <ChevronRight className="team-card-chevron" size={20} />}
                </div>

                {editingTeamId !== team.id && <div className="team-card-actions">
                  <button
                    className={isJoined ? "team-action-button team-leave-button" : "team-action-button"}
                    onClick={event => {
                      event.stopPropagation();
                      if (isJoined) {
                        if (window.confirm("Opravdu chceš odejít z tohoto týmu?")) void leaveTeam(team.id);
                      } else {
                        void joinTeam(team);
                      }
                    }}
                  >
                    {isJoined ? "Odejít" : "Přidat se"}
                  </button>

                  {user?.uid === team.createdBy && editingTeamId !== team.id && (
                    <button
                      className="team-edit-button"
                      onClick={event => {
                        event.stopPropagation();
                        startEditTeam(team);
                      }}
                      aria-label="Upravit tým"
                    >
                      <Pencil size={18} />
                    </button>
                  )}

                  {user?.uid === team.createdBy && (
                    <button
                      className="team-delete-button"
                      onClick={event => {
                        event.stopPropagation();
                        void deleteTeam(team);
                      }}
                      aria-label="Smazat tým"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>}
              </article>
            );
          })}

          {!visibleTeams.length && (
            <div className="tile teams-empty">
              <Users size={30} />
              <strong>Zatím tu není žádný tým</strong>
              <p>Vytvoř první tým pro {selectedType}.</p>
            </div>
          )}
        </section>
        )}
      </main>
    </>
  );
}
