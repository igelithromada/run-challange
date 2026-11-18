"use client";
import Metric from "../components/Metric";
import { preparePhoto } from "../lib/preparePhoto";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Users, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { ActivityTypeIcon } from "../components/ActivityTypeSelector";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { showAppToast } from "../components/AppToast";
import FormField from "../components/FormField";
import type { TeamData } from "../types";
import { fetchTeamsPage, getActiveTeamIdsForUser } from "../lib/services/teams";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

type Tab = "mine" | "all";

export default function TeamsPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPublicId, setAvatarPublicId] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<Error | null>(null);
  const [hasMoreTeams, setHasMoreTeams] = useState(false);
  const [pageCursors, setPageCursors] = useState<Array<QueryDocumentSnapshot<DocumentData, DocumentData> | null>>([null]);

  const refreshMemberships = async (uid: string) => {
    const ids = await getActiveTeamIdsForUser(uid);
    setMyTeamIds(ids);
    setTab(ids.length ? "mine" : "all");
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      try {
        const ids = await getActiveTeamIdsForUser(currentUser.uid);
        if (!active) return;
        setMyTeamIds(ids);
        setTab(ids.length ? "mine" : "all");
      } catch (error) {
        console.error("Nepodařilo se načíst členství v týmech", error);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

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

  const uploadTeamImage = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Povolené jsou pouze JPG, PNG a WebP.");
    if (file.size <= 0) throw new Error("Vybraná fotografie je prázdná.");
    if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
    const token = await auth.currentUser.getIdToken();
    const form = new FormData(); form.append("file", await preparePhoto(file));
    const response = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.secureUrl !== "string") throw new Error(result.error || "Nahrání obrázku selhalo.");
    setAvatarUrl(result.secureUrl); setAvatarPublicId(typeof result.publicId === "string" ? result.publicId : "");
  };

  const createTeam = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !user || creating) return;
    setCreating(true);
    try {
      await teamRequest("create", {
        name: trimmedName,
        description: description.trim(),
        avatarUrl, avatarPublicId,
      });
      setName("");
      setDescription(""); setAvatarUrl(""); setAvatarPublicId("");
      await refreshMemberships(user.uid);
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
    try {
      await teamRequest("join", { teamId });
      if (user) await refreshMemberships(user.uid);
      showAppToast("Přidal ses do týmu.", "success");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Do týmu se nepodařilo přidat.", "error");
    }
  };

  const pageTeams = tab === "mine" ? teams.filter(team => myTeamIds.includes(team.id)) : teams;
  const currentPage = page;

  const loadTeamsPage = async (targetPage: number) => {
    if (tab !== "all") return;
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const cursor = pageCursors[targetPage - 1] ?? null;
      const result = await fetchTeamsPage(10, cursor ?? undefined);
      setTeams(result.items);
      setHasMoreTeams(result.hasMore);
      if (result.lastDocument) {
        setPageCursors(current => {
          const next = [...current];
          next[targetPage] = result.lastDocument;
          return next;
        });
      }
    } catch (error) {
      setTeamsError(error instanceof Error ? error : new Error("Týmy se nepodařilo načíst."));
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    if (user && tab === "all") void loadTeamsPage(page);
  }, [tab, page, user, myTeamIds]);

  useEffect(() => {
    if (tab !== "mine" || !auth.currentUser) return;
    setTeamsLoading(true);
    setTeamsError(null);
    const loadMine = async () => {
      const token = await auth.currentUser!.getIdToken(true);
      const response = await fetch("/api/teams/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "listMine", page, pageSize: 10 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Týmy se nepodařilo načíst.");
      setTeams(Array.isArray(result.items) ? result.items : []);
      setHasMoreTeams(Boolean(result.hasMore));
    };
    loadMine()
      .catch(error => setTeamsError(error instanceof Error ? error : new Error("Týmy se nepodařilo načíst.")))
      .finally(() => setTeamsLoading(false));
  }, [tab, page, user, myTeamIds]);

  useEffect(() => {
    if (teamsError) showAppToast("Týmy se nepodařilo načíst. Zkus stránku obnovit.", "error");
  }, [teamsError]);

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
              <label className="professional-form-file">
                <Users size={19} aria-hidden="true" />
                <span>{avatarUrl ? "Obrázek vybrán" : "Přidat obrázek"}</span>
                <span className="professional-file-hint">volitelné</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage || creating} onChange={async event => { const file=event.target.files?.[0]; event.target.value=""; if(!file)return; setUploadingImage(true); try { await uploadTeamImage(file); showAppToast("Obrázek byl nahrán.","success"); } catch(error) { showAppToast(error instanceof Error ? error.message : "Obrázek se nepodařilo nahrát.","error"); } finally { setUploadingImage(false); } }} />
              </label>
              <div className="professional-form-actions">
                <button className="run-primary-button" onClick={() => void createTeam()} disabled={!name.trim() || creating || uploadingImage}>
                  <Plus size={18} /> {creating ? "Vytvářím…" : "Vytvořit tým"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="teams-tabs" role="tablist" aria-label="Týmy">
          <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")} role="tab" aria-selected={tab === "mine"}>
            Moje týmy
          </button>
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")} role="tab" aria-selected={tab === "all"}>
            Všechny týmy
          </button>
        </div>

        {teamsLoading ? (
          <LoadingSkeleton count={3} />
        ) : teamsError ? (
          <div className="tile teams-empty"><strong>Týmy se nepodařilo načíst</strong><p>Zkus stránku obnovit.</p></div>
        ) : (
          <>
            <section className="teams-grid">
              {pageTeams.map(team => {
                const joined = myTeamIds.includes(team.id);
                const stats = team.stats || { runningKm: 0, runningActivities: 0, walkingKm: 0, walkingActivities: 0 };
                return (
                  <article key={team.id} className={`tile team-card ${joined ? "team-card-joined" : ""}`} onClick={() => router.push("/teams/" + team.id)}>
                    <div className="team-card-main">
                      <div className="team-avatar">
                        {team.avatarUrl ? <img src={cloudinaryImageUrl(team.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : <Users size={22} />}
                      </div>
                      <div className="team-card-info">
                        <div className="team-card-title-row">
                          <h3>{team.name}</h3>
                          {joined && <span className="team-member-label">Jsi členem</span>}
                        </div>
                        {team.description && <p className="team-card-description">{team.description}</p>}
                        <p className="team-card-meta">{team.memberCount || 0} {(team.memberCount || 0) === 1 ? "člen" : "členů"}</p>
                        <div className="team-card-stats team-card-stats-compact">
                          {([
                            {type:"běh", amount:stats.runningKm, unit:"km"},
                            {type:"chůze", amount:stats.walkingKm, unit:"km"},
                            {type:"dřepy", amount:stats.squatRepetitions, unit:"×"},
                            {type:"kliky", amount:stats.pushupRepetitions, unit:"×"},
                          ] as const).filter(item=>Number(item.amount)>0).map(item=><Metric key={item.type} icon={<ActivityTypeIcon type={item.type} size={19}/>} label={item.type} value={<>{Number(item.amount).toLocaleString("cs-CZ",{maximumFractionDigits:item.unit==="km"?1:0})} {item.unit}</>}/>)}
                          {![stats.runningKm,stats.walkingKm,stats.squatRepetitions,stats.pushupRepetitions].some(value=>Number(value)>0)&&<small>Zatím bez aktivit</small>}
                        </div>
                      </div>
                      <ChevronRight className="team-card-chevron" size={20} />
                    </div>
                    {!joined && (
                      <button className="team-action-button" onClick={event => { event.stopPropagation(); void joinTeam(team.id); }}>
                        Přidat se k týmu
                      </button>
                    )}
                  </article>
                );
              })}

              {!pageTeams.length && (
                <div className="tile teams-empty">
                  <Users size={30} />
                  <strong>{tab === "mine" ? "Zatím nejsi členem žádného týmu" : "Zatím nebyl vytvořen žádný tým"}</strong>
                  <p>{tab === "mine" ? "Přidej se k existujícímu týmu nebo vytvoř vlastní." : "Vytvoř první tým a začni budovat komunitu."}</p>
                  {tab === "mine" && <button className="run-primary-button" onClick={() => setTab("all")}>Prohlédnout všechny týmy</button>}
                </div>
              )}
            </section>

            {(currentPage > 1 || hasMoreTeams) && (
              <div className="teams-pagination">
                {currentPage > 1 && <button onClick={() => setPage(value => Math.max(1, value - 1))}>Předchozí</button>}
                <span>Strana {currentPage}</span>
                {hasMoreTeams && <button onClick={() => setPage(value => value + 1)}>Další</button>}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
