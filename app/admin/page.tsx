"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ArrowLeft, Camera, ShieldCheck, User, Footprints, Ban, UserCheck, Trash2, KeyRound, Upload, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import { getAllUserProfiles, updateUserProfile } from "../lib/services/users";
import useAdminGuard from "../lib/useAdminGuard";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { showAppToast } from "../components/AppToast";

type AdminUser = { id: string; nickname: string; email: string; role?: string; blocked?: boolean; avatarUrl?: string };

export default function AdminPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [registrationCodeBusy, setRegistrationCodeBusy] = useState(false);
  const [registrationCodeMessage, setRegistrationCodeMessage] = useState("");
  const [routeFile, setRouteFile] = useState<File | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeActivity, setRouteActivity] = useState<"běh" | "chůze">("běh");
  const [routeDescription, setRouteDescription] = useState("");
  const [routeBadge, setRouteBadge] = useState("");
  const [routeGroupTitle, setRouteGroupTitle] = useState("Moje doporučené trasy");
  const [routeGroupSubtitle, setRouteGroupSubtitle] = useState("Trasy doporučené pro naši aplikaci");
  const [routeSourceUrl, setRouteSourceUrl] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [adminRoutes, setAdminRoutes] = useState<Array<{id:string;name:string;activity:string;description?:string}>>([]);
  const router = useRouter();

  useEffect(() => {
    if (error) showAppToast(error, "error");
  }, [error]);
  const adminAccess = useAdminGuard();

  const loadUsers = async (isActive: () => boolean = () => true) => {
    setLoading(true); setError("");
    try {
      const profiles = await getAllUserProfiles();
      if (!isActive()) return;
      const list: AdminUser[] = profiles.map(d => ({
        id:d.id,
        nickname:d.nickname || "",
        email:d.email || "",
        role:d.role,
        blocked:d.blocked === true,
        avatarUrl:d.avatarUrl || "",
      }));
      list.sort((a,b) => (a.nickname || a.email).localeCompare(b.nickname || b.email, "cs"));
      if (!isActive()) return;
      setUsers(list);
      if (selectedUser) setSelectedUser(list.find(u => u.id === selectedUser.id) || null);
    } catch {
      if (isActive()) setError("Seznam uživatelů se nepodařilo načíst.");
    } finally {
      if (isActive()) setLoading(false);
    }
  };

  useEffect(() => {
    if (adminAccess !== "allowed") return;
    let active = true;
    void loadUsers(() => active);
    return () => { active = false; };
  }, [adminAccess]);

  useEffect(() => {
    if (adminAccess !== "allowed") return;
    const loadRegistrationCode = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/admin/registration-code", { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Kód se nepodařilo načíst.");
        setRegistrationCode(result.code || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Registrační kód se nepodařilo načíst.");
      }
    };
    void loadRegistrationCode();
  }, [adminAccess]);

  const saveRegistrationCode = async () => {
    const code = registrationCode.trim();
    if (code.length < 4 || code.length > 128) {
      setRegistrationCodeMessage("Kód musí mít 4 až 128 znaků.");
      return;
    }
    setRegistrationCodeBusy(true);
    setRegistrationCodeMessage("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/admin/registration-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Kód se nepodařilo uložit.");
      setRegistrationCode(code);
      setRegistrationCodeMessage("Registrační kód byl uložen.");
    } catch (e) {
      setRegistrationCodeMessage(e instanceof Error ? e.message : "Kód se nepodařilo uložit.");
    } finally { setRegistrationCodeBusy(false); }
  };

  const loadAdminRoutes = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/routes", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (response.ok) setAdminRoutes(Array.isArray(result.routes) ? result.routes : []);
    } catch { /* administrace tras zůstane použitelná i při dočasném výpadku */ }
  };

  useEffect(() => {
    if (adminAccess === "allowed") void loadAdminRoutes();
  }, [adminAccess]);

  const uploadRoute = async () => {
    if (!routeFile) { setError("Vyber GPX soubor."); return; }
    if (!routeName.trim()) { setError("Zadej název trasy."); return; }
    setRouteBusy(true); setError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const form = new FormData();
      form.append("file", routeFile);
      form.append("name", routeName);
      form.append("activity", routeActivity);
      form.append("description", routeDescription);
      form.append("badge", routeBadge);
      form.append("groupId", "moje-trasy");
      form.append("groupTitle", routeGroupTitle);
      form.append("groupSubtitle", routeGroupSubtitle);
      form.append("sourceUrl", routeSourceUrl);
      const response = await fetch("/api/admin/routes", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Trasu se nepodařilo uložit.");
      setRouteFile(null); setRouteName(""); setRouteDescription(""); setRouteBadge(""); setRouteSourceUrl("");
      const input = document.getElementById("admin-route-gpx") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadAdminRoutes();
      showAppToast("Trasa byla nahrána.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trasu se nepodařilo uložit.");
    } finally { setRouteBusy(false); }
  };

  const deleteAdminRoute = async (id: string, name: string) => {
    if (!window.confirm(`Opravdu odstranit trasu „${name}“?`)) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/admin/routes", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Trasu se nepodařilo odstranit.");
      setAdminRoutes(prev => prev.filter(item => item.id !== id));
      showAppToast("Trasa byla odstraněna.", "success");
    } catch (e) { setError(e instanceof Error ? e.message : "Trasu se nepodařilo odstranit."); }
  };

  const updateUser = async (id: string, patch: Partial<AdminUser>) => {
    setBusy(true); setError("");
    try {
      await updateUserProfile(id, patch);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
      setSelectedUser(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    } catch (e) {
      console.error(e); setError("Změnu se nepodařilo uložit. Zkontroluj Firebase Security Rules.");
    } finally { setBusy(false); }
  };

  const handleToggleAdmin = async (u: AdminUser) => {
    if (u.id === auth.currentUser?.uid) { setError("Vlastní administrátorskou roli zde neměň."); return; }
    await updateUser(u.id, { role: u.role === "admin" ? "" : "admin" });
  };

  const handleBlock = async (u: AdminUser) => {
    if (u.id === auth.currentUser?.uid) { setError("Vlastní účet nemůžeš zablokovat."); return; }
    const next = !u.blocked;
    if (!window.confirm(next ? `Zablokovat uživatele ${u.nickname || u.email}?` : `Odblokovat uživatele ${u.nickname || u.email}?`)) return;
    await updateUser(u.id, { blocked: next });
  };

  const handleDeleteAccount = async (u: AdminUser) => {
    if (u.id === auth.currentUser?.uid) { setError("Vlastní administrátorský účet zde nemaž."); return; }
    const label = u.nickname || u.email || "uživatele";
    if (!window.confirm(`Opravdu trvale smazat účet ${label}? Smaže se přihlášení, profil, všechny aktivity a fotografie. Tuto akci nelze vrátit.`)) return;

    setBusy(true); setError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: u.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Účet se nepodařilo odstranit.");

      setUsers(prev => prev.filter(item => item.id !== u.id));
      setSelectedUser(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Účet se nepodařilo odstranit.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteData = async (u: AdminUser) => {
    if (u.id === auth.currentUser?.uid) { setError("Vlastní účet zde nemaž."); return; }
    if (!window.confirm(`Smazat všechny aktivity a jejich fotografie uživatele ${u.nickname || u.email}? Tato akce je nevratná.`)) return;

    setBusy(true); setError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch("/api/admin/delete-user-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: u.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Data se nepodařilo kompletně smazat.");

      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, blocked: true } : x));
      setSelectedUser(prev => prev ? { ...prev, blocked: true } : prev);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Data se nepodařilo kompletně smazat.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "myrun") { router.push("/myruns"); return; }
    if (item === "home") { router.push("/"); return; }
    if (item === "trainer") { router.push("/trainer"); return; }
    router.push("/" + item);
  };

  if (adminAccess !== "allowed") return <div className="container"><div className="tile admin-loading">Ověřuji administrátorská oprávnění…</div></div>;

  return (
    <>
      <Navbar title="Administrace" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />
      <main className="container admin-page">
        <header className="admin-header">
          <span className="admin-eyebrow">SPRÁVA APLIKACE</span>
          <h1>Administrace</h1>
          <p>Uživatelé, role, přístupy a aktivita na jednom místě.</p>
        </header>



        <section className="tile admin-route-upload">
          <div className="admin-section-heading"><FileUp size={21}/><div><h2>Nahrát doporučenou trasu</h2><span>GPX ze Stravy, hodinek nebo Mapy.com. Trasa se uloží do aplikace.</span></div></div>
          <div className="admin-registration-form admin-route-form">
            <input id="admin-route-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={e => setRouteFile(e.target.files?.[0] || null)} />
            <input type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Název trasy" />
            <select value={routeActivity} onChange={e => setRouteActivity(e.target.value as "běh" | "chůze")} aria-label="Typ aktivity">
              <option value="běh">Běh</option><option value="chůze">Chůze</option>
            </select>
            <input type="text" value={routeBadge} onChange={e => setRouteBadge(e.target.value)} placeholder="Štítek, např. Výzva" />
            <textarea value={routeDescription} onChange={e => setRouteDescription(e.target.value)} placeholder="Krátký popis trasy" rows={3} />
            <input type="text" value={routeGroupTitle} onChange={e => setRouteGroupTitle(e.target.value)} placeholder="Název skupiny" />
            <input type="text" value={routeGroupSubtitle} onChange={e => setRouteGroupSubtitle(e.target.value)} placeholder="Podnadpis skupiny" />
            <input type="url" value={routeSourceUrl} onChange={e => setRouteSourceUrl(e.target.value)} placeholder="Volitelný odkaz na zdroj" />
            <button type="button" className="admin-action-button" onClick={() => void uploadRoute()} disabled={routeBusy}><Upload size={18}/>{routeBusy ? "Nahrávám…" : "Nahrát GPX"}</button>
          </div>
          {adminRoutes.length > 0 && <div className="admin-route-list">
            {adminRoutes.map(route => <div className="admin-route-row" key={route.id}><span><strong>{route.name}</strong><small>{route.activity}</small></span><button type="button" className="admin-action-button danger" onClick={() => void deleteAdminRoute(route.id, route.name)}>Smazat</button></div>)}
          </div>}
        </section>

        <section className="tile admin-registration-code">
          <div className="admin-section-heading"><KeyRound size={21}/><div><h2>Registrační kód</h2><span>Spravuješ kód, který je potřeba pro vytvoření nového účtu.</span></div></div>
          <div className="admin-registration-form">
            <input type="text" value={registrationCode} onChange={e => setRegistrationCode(e.target.value)} maxLength={128} autoComplete="off" aria-label="Registrační kód" />
            <button type="button" className="admin-action-button" onClick={() => void saveRegistrationCode()} disabled={registrationCodeBusy}>{registrationCodeBusy ? "Ukládám…" : "Uložit kód"}</button>
          </div>
          {registrationCodeMessage && <p className="admin-muted" role="status">{registrationCodeMessage}</p>}
        </section>

        {!selectedUser ? (
          <section className="tile admin-users">
            <div className="admin-section-heading"><ShieldCheck size={21}/><div><h2>Uživatelé</h2><span>{users.length} účtů</span></div></div>
            {loading ? <p className="admin-muted">Načítám uživatele…</p> : (
              <div className="admin-user-list">
                {users.map(u => (
                  <button type="button" className="admin-user-row" key={u.id} onClick={() => setSelectedUser(u)}>
                    <span className="admin-user-avatar">{u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <User size={19}/>}</span>
                    <span className="admin-user-copy"><strong>{u.nickname || "Beze jména"}</strong><small>{u.email}</small></span>
                    {u.blocked && <span className="admin-status-badge blocked">BLOKOVÁN</span>}
                    {u.role === "admin" && <span className="admin-role">ADMIN</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="tile admin-detail">
            <button type="button" className="ui-icon-button admin-back-button" onClick={() => setSelectedUser(null)} aria-label="Zpět na seznam" title="Zpět na seznam"><ArrowLeft size={17}/></button>
            <div className="admin-detail-heading">
              <span className="admin-user-avatar large">{selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt="" /> : <User size={25}/>}</span>
              <div><h2>{selectedUser.nickname || "Beze jména"}</h2><p>{selectedUser.email}</p><div className="admin-detail-status">{selectedUser.blocked ? <span className="admin-status-badge blocked">BLOKOVÁN</span> : <span className="admin-status-badge">AKTIVNÍ</span>}</div></div>
            </div>

            <div className="admin-actions">
              <button type="button" className="admin-action-button" onClick={() => void handleToggleAdmin(selectedUser)} disabled={busy}><ShieldCheck size={18}/> {selectedUser.role === "admin" ? "Odebrat roli admin" : "Přidat jako admin"}</button>
              <button type="button" className={`admin-action-button ${selectedUser.blocked ? "" : "admin-action-warning"}`} onClick={() => void handleBlock(selectedUser)} disabled={busy}>{selectedUser.blocked ? <UserCheck size={18}/> : <Ban size={18}/>} {selectedUser.blocked ? "Odblokovat uživatele" : "Zablokovat uživatele"}</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/records`)}><Footprints size={18}/> Zobrazit záznamy</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/gallery`)}><Camera size={18}/> Zobrazit galerii</button>
              <button type="button" className="admin-action-button danger" onClick={() => void handleDeleteData(selectedUser)} disabled={busy}><Trash2 size={18}/> Smazat data aktivit</button>
              <button type="button" className="admin-action-button danger admin-delete-account-button" onClick={() => void handleDeleteAccount(selectedUser)} disabled={busy}><Trash2 size={18}/> Smazat účet a všechna data</button>
            </div>

            <p className="admin-muted admin-note">Úplné smazání používá Firebase Admin a Cloudinary API. Odstraní přihlášení, profil, aktivity i fotografie uživatele. Pokud Cloudinary odmítne mazání, účet se z bezpečnostních důvodů nesmaže.</p>
          </section>
        )}
      </main>
    </>
  );
}
