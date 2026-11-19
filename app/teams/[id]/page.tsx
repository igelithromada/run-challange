"use client";
import FormField from "../../components/FormField";
import Metric from "../../components/Metric";
import TeamCardContent from "../../components/TeamCardContent";
import CoverField, { useCoverDraft } from "../../components/CoverField";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Users, Crown, Trash2 } from "lucide-react";
import { auth } from "../../lib/firebase";
import { ActivityTypeIcon } from "../../components/ActivityTypeSelector";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { cloudinaryImageUrl } from "../../lib/imageUrl";
import type { TeamData, PublicProfileData } from "../../types";
import { getPublicProfiles } from "../../lib/services/publicProfiles";
import { getTeam, getTeamMemberIds } from "../../lib/services/teams";
import { showAppToast } from "../../components/AppToast";

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

  const save = async () => {
    if (!isManager || !team) return;
    setSaving(true);
    try {
      await request("edit", { name, description, ...await cover.resolve(team) });
      await load();
      cover.reset();
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
    if (!isManager || !selectedManager) return;
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
    if (!isManager || !window.confirm("Opravdu chceš tento tým trvale smazat?")) return;
    try {
      await request("delete");
      showAppToast("Tým byl smazán.", "success");
      router.push("/teams");
    } catch (error) {
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

        <section className="tile activity-card activity-card-modern record-summary-card">
          <TeamCardContent team={team} detail/>
        </section>

        <section className="tile team-stats-card">
          <div className="progress-section-title"><Users /><div><h2>Statistiky týmu</h2><p>{team.memberCount || 0} {(team.memberCount || 0) === 1 ? "člen" : "členů"}</p></div></div>
          <div data-metric-layout="summary" className="team-stats-rows">
            <Metric icon={<ActivityTypeIcon type="běh" size={20}/>} label="Běh" tone="distance" value={Number(stats.runningKm || 0).toLocaleString("cs-CZ")} unit="km" detail={`${Number(stats.runningActivities || 0)} aktivit`}/>
            <Metric icon={<ActivityTypeIcon type="chůze" size={20}/>} label="Chůze" tone="distance" value={Number(stats.walkingKm || 0).toLocaleString("cs-CZ")} unit="km" detail={`${Number(stats.walkingActivities || 0)} aktivit`}/>
            <Metric icon={<ActivityTypeIcon type="dřepy" size={20}/>} label="Dřepy" tone="repetitions" value={Number(stats.squatRepetitions || 0).toLocaleString("cs-CZ")} unit="opakování" detail={`${Number(stats.squatActivities || 0)} aktivit`}/>
            <Metric icon={<ActivityTypeIcon type="kliky" size={20}/>} label="Kliky" tone="repetitions" value={Number(stats.pushupRepetitions || 0).toLocaleString("cs-CZ")} unit="opakování" detail={`${Number(stats.pushupActivities || 0)} aktivit`}/>
          </div>
        </section>

        {isManager && (
          <section className="tile team-settings-card">
            <div className="progress-section-title"><Save /><div><h2>Správa týmu</h2><p>Můžeš kdykoli upravit název, popis a obrázek týmu.</p></div></div>
            <FormField className="team-detail-field" label="Název týmu"><input value={name} maxLength={40} onChange={e => setName(e.target.value)} /></FormField>
            <FormField className="team-detail-field" label="Popis"><input value={description} maxLength={200} onChange={e => setDescription(e.target.value)} /></FormField>
            <CoverField draft={cover} existing={team.avatarUrl} busy={saving}/>
            <button className="run-primary-button team-save-button" onClick={() => void save()} disabled={saving}><Save size={18} />{saving ? "Ukládám…" : "Uložit změny"}</button>
          </section>
        )}

        <section className="tile team-members-card">
          <div className="progress-section-title"><Users /><div><h2>Členové</h2><p>Každý člen má vlastní profil.</p></div></div>
          <div className="team-members-list">
            {members.map(member => (
              <button key={member.id} type="button" className="team-member-row" onClick={() => router.push("/user/" + member.id)}>
                <span className="team-member-avatar">{member.avatarUrl ? <img src={cloudinaryImageUrl(member.avatarUrl, 96)} alt="" loading="lazy" decoding="async" /> : (member.nickname || "U").charAt(0).toUpperCase()}</span>
                <span><strong>{member.nickname || "Uživatel"}</strong></span>
                {member.id === team.managerId && <Crown size={16} aria-label="Správce týmu" />}
              </button>
            ))}
          </div>
        </section>

        {isMember && (
          <section className="team-management-actions">
            {isManager ? (
              otherMembers.length ? (
                <div className="tile">
                  <strong>Předat správu a odejít</strong>
                  <p>Nejdříve vyber nového správce.</p>
                  <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)}>
                    <option value="">Vyber člena</option>
                    {otherMembers.map(member => <option key={member.id} value={member.id}>{member.nickname || "Uživatel"}</option>)}
                  </select>
                  <button className="run-secondary-button" disabled={!selectedManager} onClick={() => void transferAndLeave()}>Předat správu a odejít</button>
                </div>
              ) : (
                <div className="tile"><p>Jsi jediný člen. Tým můžeš pouze smazat.</p></div>
              )
            ) : (
              <button type="button" className="trainer-secondary-button team-leave-button" onClick={() => void leave()}>Odejít z týmu</button>
            )}

            {isManager && <button type="button" className="team-delete-button" onClick={() => void deleteTeam()}><Trash2 size={17} /> Smazat tým</button>}
          </section>
        )}
      </main>
    </>
  );
}
