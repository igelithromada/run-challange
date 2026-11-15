"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, Footprints, Plus, Target, Trophy, Users, XCircle } from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import { showAppToast } from "../components/AppToast";

type ChallengeType = "distance" | "activeDays" | "activities" | "target";
type Scope = "individual" | "team";

type Challenge = {
  id: string;
  title: string;
  description?: string;
  type: ChallengeType;
  scope: Scope;
  activityType: ActivityType;
  startAt: string;
  endAt: string;
  createdBy: string;
  participantIds?: string[];
  teamIds?: string[];
  status: "upcoming" | "active" | "finished";
  targetValue?: number;
};

type Team = { id: string; name: string; type?: ActivityType; memberIds?: string[] };

const typeLabels: Record<ChallengeType, { title: string; description: string }> = {
  distance: { title: "Nejvíce kilometrů", description: "Vyhrává účastník nebo tým s největší vzdáleností." },
  activeDays: { title: "Nejvíce aktivních dní", description: "Rozhoduje počet různých dní, ve kterých proběhla aktivita." },
  activities: { title: "Nejvíce aktivit", description: "Vyhrává nejvyšší počet zaznamenaných aktivit." },
  target: { title: "Dosažení cíle", description: "Úkolem je dosáhnout stanoveného počtu kilometrů." },
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

export default function ChallengesPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("distance");
  const [scope, setScope] = useState<Scope>("individual");
  const [activityType, setActivityType] = useState<ActivityType>("běh");
  const [teamId, setTeamId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [targetValue, setTargetValue] = useState("100");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    const response = await fetch("/api/challenges", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Výzvy se nepodařilo načíst.");
    setUid(data.uid || auth.currentUser.uid);
    setChallenges(data.challenges || []);

    const teamResponse = await fetch("/api/teams/list", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      setTeams((teamData.teams || []).filter((team: Team) => Array.isArray(team.memberIds) && team.memberIds.includes(auth.currentUser!.uid)));
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try { await load(); } catch (error) { if (active) showAppToast(error instanceof Error ? error.message : "Výzvy se nepodařilo načíst.", "error"); }
      finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, []);

  const myChallenges = useMemo(() => challenges.filter(challenge =>
    challenge.scope === "individual" ? challenge.participantIds?.includes(uid) : challenge.teamIds?.some(id => teams.some(team => team.id === id))
  ), [challenges, uid, teams]);

  const create = async () => {
    if (!title.trim() || !startAt || !endAt || (scope === "team" && !teamId)) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create", title, description, type, scope, activityType, teamId,
          startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(),
          targetValue: type === "target" ? Number(targetValue) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Výzvu se nepodařilo vytvořit.");
      showAppToast("Výzva byla vytvořena.", "success");
      setShowCreate(false);
      setTitle(""); setDescription("");
      await load();
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Výzvu se nepodařilo vytvořit.", "error");
    } finally { setSaving(false); }
  };

  const join = async (challenge: Challenge) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const selectedTeam = challenge.scope === "team" ? teams.find(team => team.type === challenge.activityType && !challenge.teamIds?.includes(team.id)) : undefined;
      if (challenge.scope === "team" && !selectedTeam) {
        showAppToast("Nejsi členem žádného vhodného týmu.", "error");
        return;
      }
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "join", challengeId: challenge.id, teamId: selectedTeam?.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Do výzvy se nepodařilo přihlásit.");
      showAppToast("Do výzvy ses přihlásil.");
      await load();
    } catch (error) { showAppToast(error instanceof Error ? error.message : "Do výzvy se nepodařilo přihlásit.", "error"); }
  };

  const challengeIcon = (challenge: Challenge) => challenge.scope === "team" ? <Users size={19}/> : challenge.type === "target" ? <Target size={19}/> : challenge.type === "distance" ? <Footprints size={19}/> : challenge.type === "activities" ? <Trophy size={19}/> : <CalendarDays size={19}/>;

  return <>
    <Navbar title="Výzvy" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
    <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={item => {
      setMenuVisible(false);
      if (item === "challenges") return;
      if (item === "logout") return;
      router.push(item === "home" ? "/" : "/" + item);
    }} />
    <main className="container challenges-page">
      <header className="challenges-header">
        <span className="progress-eyebrow">SOUTĚŽ DOBROVOLNĚ</span>
        <h1>Výzvy</h1>
        <p>Výzva je samostatná soutěž s jasným typem, pravidly a pevným začátkem a koncem. Tým sám o sobě není žebříček.</p>
        <button className="run-primary-button" onClick={() => setShowCreate(v => !v)}><Plus size={18}/> Vytvořit výzvu</button>
      </header>

      {showCreate && <section className="tile challenge-create-card">
        <div className="progress-section-title"><Target/><div><h2>Nová výzva</h2><p>Formulář se mění podle zvoleného typu. Účast je vždy dobrovolná.</p></div></div>
        <div className="challenge-form-grid">
          <label>Název<input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="Např. Dolní Lhota – jarní výzva"/></label>
          <label>Popis<textarea value={description} maxLength={500} onChange={e => setDescription(e.target.value)} placeholder="Pravidla a motivace"/></label>
          <div className="challenge-form-wide">
            <span className="control-caption">Typ výzvy</span>
            <div className="challenge-type-grid">{(Object.keys(typeLabels) as ChallengeType[]).map(key =>
              <button key={key} type="button" className={type === key ? "challenge-type active" : "challenge-type"} onClick={() => setType(key)}>
                <strong>{typeLabels[key].title}</strong><small>{typeLabels[key].description}</small>
              </button>
            )}</div>
          </div>
          <div className="challenge-form-wide">
            <span className="control-caption">Kdo soutěží</span>
            <div className="challenge-scope-grid">
              <button type="button" className={scope === "individual" ? "challenge-type active" : "challenge-type"} onClick={() => setScope("individual")}><strong>Jednotlivci</strong><small>Každý účastník má vlastní výsledek.</small></button>
              <button type="button" className={scope === "team" ? "challenge-type active" : "challenge-type"} onClick={() => setScope("team")}><strong>Týmy</strong><small>Výsledek týmu se počítá spravedlivě podle aktivních účastníků.</small></button>
            </div>
          </div>
          <div className="challenge-form-wide"><span className="control-caption">Aktivita</span><ActivityTypeSelector value={activityType} onChange={setActivityType} ariaLabel="Aktivita výzvy"/></div>
          {scope === "team" && <label>Tým<select value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Vyber tým</option>{teams.filter(team => (team.type === "chůze" ? "chůze" : "běh") === activityType).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
          {type === "target" && <label>Cíl (km)<input type="number" min="0.1" max="100000" step="1" value={targetValue} onChange={e => setTargetValue(e.target.value)}/></label>}
          <label>Začátek<input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}/></label>
          <label>Konec<input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}/></label>
        </div>
        <div className="challenge-create-actions"><button className="run-secondary-button" onClick={() => setShowCreate(false)}>Zrušit</button><button className="run-primary-button" disabled={saving || !title.trim()} onClick={() => void create()}>{saving ? "Vytvářím…" : "Vytvořit výzvu"}</button></div>
      </section>}

      <section className="challenge-section">
        <div className="progress-section-title"><Trophy/><div><h2>Aktivní a připravované</h2><p>Do soutěží se přihlašuješ dobrovolně před jejich začátkem.</p></div></div>
        {loading ? <div className="tile">Načítám výzvy…</div> : challenges.filter(c => c.status !== "finished").length === 0 ? <div className="tile challenge-empty">Zatím tu není žádná výzva.</div> :
          <div className="challenge-grid">{challenges.filter(c => c.status !== "finished").map(challenge => {
            const joined = challenge.scope === "individual" ? challenge.participantIds?.includes(uid) : challenge.teamIds?.some(id => teams.some(team => team.id === id));
            return <article className="tile challenge-card" key={challenge.id} onClick={() => router.push("/challenges/" + challenge.id)}>
              <div className="challenge-card-icon">{challengeIcon(challenge)}</div>
              <div className="challenge-card-main"><div className="challenge-status">{challenge.status === "active" ? "PROBÍHÁ" : "PŘIPRAVUJE SE"}</div><h3>{challenge.title}</h3><strong>{typeLabels[challenge.type].title}</strong><p>{formatDate(challenge.startAt)} – {formatDate(challenge.endAt)}</p><span>{challenge.scope === "team" ? "Týmová" : "Individuální"} · {challenge.activityType}</span></div>
              <div className="challenge-card-side">{joined ? <CheckCircle2 size={22}/> : <ChevronRight size={22}/>}</div>
              {!joined && challenge.status === "upcoming" && <button className="challenge-join-button" onClick={e => { e.stopPropagation(); void join(challenge); }}>Přidat se</button>}
            </article>;
          })}</div>}
      </section>

      <section className="challenge-section">
        <div className="progress-section-title"><CheckCircle2/><div><h2>Moje výzvy</h2><p>Výzvy, do kterých ses přihlásil nebo které jsi vytvořil.</p></div></div>
        <div className="challenge-grid">{myChallenges.length ? myChallenges.map(challenge => <article className="tile challenge-card compact" key={challenge.id} onClick={() => router.push("/challenges/" + challenge.id)}><div className="challenge-card-icon">{challengeIcon(challenge)}</div><div className="challenge-card-main"><h3>{challenge.title}</h3><span>{challenge.status === "finished" ? "Dokončeno" : challenge.status === "active" ? "Probíhá" : "Připraveno"}</span></div><ChevronRight size={20}/></article>) : <div className="tile challenge-empty">Zatím nejsi přihlášený do žádné výzvy.</div>}</div>
      </section>
    </main>
  </>;
}
