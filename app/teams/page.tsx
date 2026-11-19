"use client";
import RecordCard from "../components/RecordCard";
import TeamCardContent from "../components/TeamCardContent";
import Link from "next/link";
import CoverField, { useCoverDraft } from "../components/CoverField";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Users, X } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { showAppToast } from "../components/AppToast";
import FormField from "../components/FormField";
import type { TeamData } from "../types";
import { fetchTeamDirectory } from "../lib/services/teams";

type Tab = "mine" | "all";
const PAGE_SIZE = 10;

export default function TeamsPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const cover = useCoverDraft(user?.uid || "");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<Error | null>(null);
  const [reload, setReload] = useState(0);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const [directoryUid, setDirectoryUid] = useState<string>();

  useEffect(() => onAuthStateChanged(auth, currentUser => {
    setUser(currentUser);
    if (!currentUser) router.push("/login");
  }), [router]);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    const controller = new AbortController();
    setTeamsLoading(true);
    setTeamsError(null);
    void fetchTeamDirectory(controller.signal).then(({ teams, joinedIds }) => {
      if (controller.signal.aborted || auth.currentUser?.uid !== uid) return;
      setDirectoryUid(uid);
      setTeams(teams);
      setMyTeamIds(joinedIds);
      if (loadedFor.current !== uid) {
        loadedFor.current = uid;
        setTab(joinedIds.length ? "mine" : "all");
        setPage(1);
      }
      setTeamsLoading(false);
    }).catch(error => {
      if (controller.signal.aborted || auth.currentUser?.uid !== uid) return;
      setTeamsError(error instanceof Error ? error : new Error("Týmy se nepodařilo načíst."));
      setTeamsLoading(false);
    });
    return () => controller.abort();
  }, [uid, reload]);

  const chooseTab = (value: Tab) => {
    setTab(value);
    setPage(1);
  };

  const teamRequest = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
    const token = await auth.currentUser.getIdToken(true);
    const response = await fetch("/api/teams/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Operaci se nepodařilo dokončit.");
    return result;
  };


  const createTeam = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !user || creating) return;
    setCreating(true);
    try {
      await teamRequest("create", {
        name: trimmedName,
        description: description.trim(),
        ...await cover.resolve(),
      });
      setName("");
      setDescription(""); cover.reset();
      if (auth.currentUser?.uid !== user.uid) return;
      chooseTab("mine");
      setReload(current => current + 1);
      setShowCreate(false);
      setPage(1);
      showAppToast("Tým byl vytvořen.", "success");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Tým se nepodařilo vytvořit.", "error");
    } finally {
      setCreating(false);
    }
  };

  const joinTeam = async (teamId: string) => {
    if (!uid || joiningId) return;
    setJoiningId(teamId);
    try {
      await teamRequest("join", { teamId });
      if (auth.currentUser?.uid !== uid) return;
      setMyTeamIds(current => current.includes(teamId) ? current : [...current, teamId]);
      setReload(current => current + 1);
      showAppToast("Přidal ses do týmu.", "success");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Do týmu se nepodařilo přidat.", "error");
    } finally {
      setJoiningId(null);
    }
  };

  const scopedTeams = tab === "mine" ? teams.filter(team => myTeamIds.includes(team.id)) : teams;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(scopedTeams.length / PAGE_SIZE)));
  const pageTeams = scopedTeams.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasMoreTeams = currentPage * PAGE_SIZE < scopedTeams.length;
  const waitingForAccount = directoryUid !== uid && !teamsError;

  return (
    <>
      <Navbar title="Týmy" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <main className="container teams-page">
        <header className="teams-header">
          <span className="teams-eyebrow">SPOLEČNĚ ZA POHYBEM</span>
          <h1>Týmy</h1>
          <p>Najdi lidi se stejným zájmem o pohyb, nebo založ vlastní tým.</p>
        </header>

        {!showCreate ? (
          <button type="button" className="run-primary-button teams-create-launch" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Vytvořit tým
          </button>
        ) : (
          <section className="tile teams-create">
            <div className="teams-section-heading">
              <div>
                <h2>Vytvořit tým</h2>
                <p>Každý tým je veřejný a po vytvoření se stáváš jeho správcem.</p>
              </div>
              <button type="button" className="ui-icon-button" onClick={() => setShowCreate(false)} aria-label="Zavřít formulář"><X size={18} /></button>
            </div>
            <div className="teams-create-form professional-form">
              <FormField label="Název týmu">
                <input type="text" maxLength={40} placeholder="Např. Dolní Lhota běhá" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void createTeam(); }} />
              </FormField>
              <FormField label="Popis" hint="volitelné">
                <textarea maxLength={200} placeholder="Krátce popiš, pro koho je tým určený." value={description} onChange={event => setDescription(event.target.value)} />
              </FormField>
              <CoverField draft={cover} busy={creating}/>
              <div className="professional-form-actions">
                <button className="run-primary-button" onClick={() => void createTeam()} disabled={!name.trim() || creating}>
                  <Plus size={18} /> {creating ? "Vytvářím…" : "Vytvořit tým"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="teams-tabs" role="tablist" aria-label="Týmy">
          <button className={tab === "mine" ? "active" : ""} onClick={() => chooseTab("mine")} role="tab" disabled={waitingForAccount} aria-selected={tab === "mine"}>
            Moje týmy
          </button>
          <button className={tab === "all" ? "active" : ""} onClick={() => chooseTab("all")} role="tab" disabled={waitingForAccount} aria-selected={tab === "all"}>
            Všechny týmy
          </button>
        </div>

        {teamsLoading || waitingForAccount ? (
          <LoadingSkeleton count={3} />
        ) : teamsError ? (
          <div className="tile teams-empty"><strong>Týmy se nepodařilo načíst</strong><button type="button" className="tile-button" onClick={() => setReload(current => current + 1)}>Zkusit znovu</button></div>
        ) : (
          <>
            <section className="teams-grid">
              {pageTeams.map(team => {
                const joined = myTeamIds.includes(team.id);
                return (
                  <RecordCard key={team.id} className="record-summary-card">
                      <TeamCardContent team={team} joined={joined}/>
                      <footer className="activity-card-actions record-summary-footer">
                        <Link href={`/teams/${encodeURIComponent(team.id)}`} className="record-detail-link" aria-label={`Detail týmu ${team.name}`}>Detail týmu <ChevronRight size={16} aria-hidden="true"/></Link>
                      </footer>
                    {!joined && (
                      <button className="team-action-button" disabled={joiningId !== null} onClick={() => void joinTeam(team.id)}>
                        {joiningId === team.id ? "Přihlašuji…" : "Přidat se k týmu"}
                      </button>
                    )}
                  </RecordCard>
                );
              })}

              {!pageTeams.length && (
                <div className="tile teams-empty">
                  <Users size={30} />
                  <strong>{tab === "mine" ? "Zatím nejsi členem žádného týmu" : "Zatím nebyl vytvořen žádný tým"}</strong>
                  <p>{tab === "mine" ? "Přidej se k existujícímu týmu nebo vytvoř vlastní." : "Vytvoř první tým a začni budovat komunitu."}</p>
                  {tab === "mine" && <button className="run-primary-button" onClick={() => chooseTab("all")}>Prohlédnout všechny týmy</button>}
                </div>
              )}
            </section>

            {(currentPage > 1 || hasMoreTeams) && (
              <div className="teams-pagination">
                {currentPage > 1 && <button onClick={() => setPage(currentPage - 1)}>Předchozí</button>}
                <span>Strana {currentPage}</span>
                {hasMoreTeams && <button onClick={() => setPage(currentPage + 1)}>Další</button>}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
