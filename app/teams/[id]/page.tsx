"use client";
import EntryFormPanel from "../../components/EntryFormPanel";
import FormField from "../../components/FormField";
import Metric from "../../components/Metric";
import RecordCard, { RecordMetrics } from "../../components/RecordCard";
import TeamCardContent from "../../components/TeamCardContent";
import CoverField, { useCoverDraft } from "../../components/CoverField";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Save, Users, Crown, Trash2 } from "lucide-react";
import { auth } from "../../lib/firebase";
import { ActivityTypeIcon } from "../../components/ActivityTypeSelector";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import UserAvatar from "../../components/UserAvatar";
import type { TeamData, PublicProfileData } from "../../types";
import { getPublicProfiles } from "../../lib/services/publicProfiles";
import { getTeam, getTeamMemberIds } from "../../lib/services/teams";
import { showAppToast } from "../../components/AppToast";

function activityCount(value = 0) {
  const unit = value === 1 ? "aktivita" : value >= 2 && value <= 4 ? "aktivity" : "aktivit";
  return `${value} ${unit}`;
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<PublicProfileData[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const cover = useCoverDraft(`${user?.uid || ""}/${id}`);
  const [selectedManager, setSelectedManager] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const request = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!auth.currentUser) throw new Error("Nejsi přihlášen.");
    const token = await auth.currentUser.getIdToken(true);
    const response = await fetch("/api/teams/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, teamId: id, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Operaci se nepodařilo dokončit.");
    return result;
  };

  const load = async () => {
    if (!id) return;
    const data = await getTeam(id);
    if (!data) {
      router.replace("/teams");
      return;
    }
    let sorted: PublicProfileData[] = [];
    try {
      const memberIds = await getTeamMemberIds(id);
      let profiles: Record<string, PublicProfileData> = {};
      try { profiles = await getPublicProfiles(memberIds); } catch(error) { console.error("Profily členů nejsou dostupné",error); }
      sorted = memberIds.map(id => profiles[id] || { id, nickname: "Uživatel" }).sort((a, b) =>
        (a.nickname || "Uživatel").localeCompare(b.nickname || "Uživatel", "cs")
      );
    } catch (memberError) {
      // Detail týmu nesmí spadnout jen proto, že se nepodařilo načíst
      // sekundární data členů. Základní tým je samostatně dostupný.
      console.error("Nepodařilo se načíst členy týmu", memberError);
    }
    setTeam(data);
    setMembers(sorted);
    setName(data.name || "");
    setDescription(data.description || "");
    setSelectedManager("");
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!active) return;
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      try {
        await load();
      } catch (error) {
        console.error("Nepodařilo se načíst tým", error);
        if (active) {
          showAppToast("Tým se nepodařilo načíst.", "error");
          setLoading(false);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, router]);

  const isManager = team?.managerId === user?.uid;
  const isMember = !!user && members.some(member => member.id === user.uid);

  const openEdit = () => {
    if (!team) return;
    setName(team.name || "");
    setDescription(team.description || "");
    cover.reset();
    setEditing(true);
  };

  const closeEdit = () => {
    cover.reset();
    setEditing(false);
  };

  const save = async () => {
    if (!isManager || !team || saving || deleting) return;
    setSaving(true);
    try {
      await request("edit", { name, description, ...await cover.resolve(team) });
      await load();
      closeEdit();
      showAppToast("Nastavení týmu bylo uloženo.", "success");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Nastavení se nepodařilo uložit.", "error");
    } finally {
      setSaving(false);
    }
  };


  const leave = async () => {
    if (!isMember || isManager) return;
    if (!window.confirm("Opravdu chceš odejít z tohoto týmu?")) return;
    try {
      await request("leave");
      showAppToast("Z týmu jsi odešel.", "success");
      router.push("/teams");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Z týmu se nepodařilo odejít.", "error");
    }
  };

  const transferAndLeave = async () => {
    if (!isManager || !selectedManager || saving || deleting) return;
    const target = members.find(member => member.id === selectedManager);
    if (!target) return;
    if (!window.confirm(`Předat správu uživateli ${target.nickname || "Uživatel"} a odejít z týmu?`)) return;
    try {
      await request("transfer", { newManagerId: selectedManager, leaveCurrentManager: true });
      showAppToast("Správa byla předána a z týmu jsi odešel.", "success");
      router.push("/teams");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Správu se nepodařilo předat.", "error");
    }
  };

  const deleteTeam = async () => {
    if (!isManager || saving || deleting || !window.confirm("Opravdu chceš tento tým trvale smazat?")) return;
    setDeleting(true);
    try {
      await request("delete");
      showAppToast("Tým byl smazán.", "success");
      router.push("/teams");
    } catch (error) {
      setDeleting(false);
      showAppToast(error instanceof Error ? error.message : "Tým se nepodařilo smazat.", "error");
    }
  };

  if (loading) {
    return <><Navbar title="Tým" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} /><Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} /><main className="container"><div className="tile"><p>Načítám tým…</p></div></main></>;
  }

  if (!team) return null;

  const stats = team.stats || { runningKm: 0, runningActivities: 0, walkingKm: 0, walkingActivities: 0 };
  const otherMembers = members.filter(member => member.id !== user?.uid);

  return (
    <>
      <Navbar title={team.name || "Tým"} onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <main className="container team-detail-page">
        <button className="ui-icon-button team-back-button" type="button" onClick={() => router.push("/teams")} aria-label="Zpět na týmy" title="Zpět na týmy"><ArrowLeft size={19} /></button>

        <RecordCard className="record-summary-card">
          <TeamCardContent team={team} detail/>
          <RecordMetrics layout="summary">
            <Metric icon={<ActivityTypeIcon type="běh" size={20}/>} label="Běh" tone="distance" value={Number(stats.runningKm || 0).toLocaleString("cs-CZ")} unit="km" detail={activityCount(stats.runningActivities)}/>
            <Metric icon={<ActivityTypeIcon type="chůze" size={20}/>} label="Chůze" tone="distance" value={Number(stats.walkingKm || 0).toLocaleString("cs-CZ")} unit="km" detail={activityCount(stats.walkingActivities)}/>
            <Metric icon={<ActivityTypeIcon type="dřepy" size={20}/>} label="Dřepy" tone="repetitions" value={Number(stats.squatRepetitions || 0).toLocaleString("cs-CZ")} unit="opakování" detail={activityCount(stats.squatActivities)}/>
            <Metric icon={<ActivityTypeIcon type="kliky" size={20}/>} label="Kliky" tone="repetitions" value={Number(stats.pushupRepetitions || 0).toLocaleString("cs-CZ")} unit="opakování" detail={activityCount(stats.pushupActivities)}/>
          </RecordMetrics>
        </RecordCard>

        {isManager && (
          <div className="team-settings-card">
            {editing ? (
              <EntryFormPanel title="Upravit tým" onClose={closeEdit} busy={saving}>
                <FormField label="Název týmu">
                  <input value={name} maxLength={40} onChange={e => setName(e.target.value)} />
                </FormField>
                <FormField label="Popis" hint="volitelné">
                  <textarea value={description} maxLength={200} onChange={e => setDescription(e.target.value)} />
                </FormField>
                <CoverField draft={cover} existing={team.avatarUrl} busy={saving}/>
                <button type="button" className="run-primary-button" onClick={() => void save()} disabled={saving || deleting || !name.trim()}>
                  <Save size={18} aria-hidden="true" />{saving ? "Ukládám…" : "Uložit změny"}
                </button>
              </EntryFormPanel>
            ) : (
              <button type="button" className="run-secondary-button" onClick={openEdit} disabled={deleting}>
                <Pencil size={17} aria-hidden="true" /> Upravit tým
              </button>
            )}
          </div>
        )}

        <section className="tile team-members-card">
          <div className="progress-section-title"><Users /><div><h2>Členové</h2><p>Každý člen má vlastní profil.</p></div></div>
          <div className="team-members-list">
            {members.map(member => (
              <button key={member.id} type="button" className="team-member-row" onClick={() => router.push("/user/" + member.id)}>
                <UserAvatar name={member.nickname || "Uživatel"} url={member.avatarUrl} className="team-member-avatar"/>
                <span><strong>{member.nickname || "Uživatel"}</strong></span>
                {member.id === team.managerId && <Crown size={16} aria-label="Správce týmu" />}
              </button>
            ))}
          </div>
        </section>

        {isMember && (
          <section className={isManager ? "tile team-management-actions" : "team-management-actions"}>
            {isManager ? (
              otherMembers.length ? (
                <div className="team-transfer-actions">
                  <strong>Předat správu a odejít</strong>
                  <p>Nejdříve vyber nového správce.</p>
                  <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)}>
                    <option value="">Vyber člena</option>
                    {otherMembers.map(member => <option key={member.id} value={member.id}>{member.nickname || "Uživatel"}</option>)}
                  </select>
                  <button className="run-secondary-button" disabled={!selectedManager || saving || deleting} onClick={() => void transferAndLeave()}>Předat správu a odejít</button>
                </div>
              ) : (
                <p>Jsi jediný člen. Pokud chceš tým opustit, můžeš ho smazat.</p>
              )
            ) : (
              <button type="button" className="trainer-secondary-button team-leave-button" onClick={() => void leave()}>Odejít z týmu</button>
            )}

            {isManager && (
              <button type="button" className="run-danger-button team-detail-delete" disabled={saving || deleting} onClick={() => void deleteTeam()}>
                <Trash2 size={17} aria-hidden="true" /> {deleting ? "Mažu tým…" : "Smazat tým"}
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
