"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ArrowLeft, Camera, ShieldCheck, User, Footprints, Ban, UserCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import useAdminGuard from "../lib/useAdminGuard";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

type AdminUser = { id: string; nickname: string; email: string; role?: string; blocked?: boolean; avatarUrl?: string };

export default function AdminPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const adminAccess = useAdminGuard();

  const loadUsers = async () => {
    setLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const list: AdminUser[] = snapshot.docs.map(s => {
        const d = s.data();
        return { id:s.id, nickname:d.nickname||"", email:d.email||"", role:d.role, blocked:d.blocked===true, avatarUrl:d.avatarUrl||"" };
      });
      list.sort((a,b) => (a.nickname || a.email).localeCompare(b.nickname || b.email, "cs"));
      setUsers(list);
      if (selectedUser) setSelectedUser(list.find(u => u.id === selectedUser.id) || null);
    } catch { setError("Seznam uživatelů se nepodařilo načíst."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (adminAccess === "allowed") void loadUsers(); }, [adminAccess]);

  const updateUser = async (id: string, patch: Partial<AdminUser>) => {
    setBusy(true); setError("");
    try {
      await updateDoc(doc(db, "users", id), patch);
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
    if (!window.confirm(`Opravdu trvale smazat účet ${label}? Smaže se přihlášení, profil i všechny aktivity. Tuto akci nelze vrátit.`)) return;

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
    if (!window.confirm(`Smazat všechny aktivity uživatele ${u.nickname || u.email}? Tato akce je nevratná.`)) return;
    setBusy(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "runs"));
      const ownRuns = snapshot.docs.filter(d => d.data().uid === u.id);
      await Promise.all(ownRuns.map(d => import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(d.ref))));
      await updateDoc(doc(db, "users", u.id), { deletedDataAt: new Date().toISOString(), blocked: true });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, blocked:true } : x));
      setSelectedUser(prev => prev ? { ...prev, blocked:true } : prev);
    } catch (e) {
      console.error(e); setError("Data se nepodařilo kompletně smazat.");
    } finally { setBusy(false); }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "myrun") { router.push("/myruns"); return; }
    if (item === "home") { router.push("/"); return; }
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

        {error && <p className="form-message form-message-error" role="alert">{error}</p>}

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
            <button type="button" className="admin-back-button" onClick={() => setSelectedUser(null)}><ArrowLeft size={17}/> Zpět na seznam</button>
            <div className="admin-detail-heading">
              <span className="admin-user-avatar large">{selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt="" /> : <User size={25}/>}</span>
              <div><h2>{selectedUser.nickname || "Beze jména"}</h2><p>{selectedUser.email}</p><div className="admin-detail-status">{selectedUser.blocked ? <span className="admin-status-badge blocked">BLOKOVÁN</span> : <span className="admin-status-badge">AKTIVNÍ</span>}</div></div>
            </div>

            <div className="admin-actions">
              <button type="button" className="admin-action-button" onClick={() => void handleToggleAdmin(selectedUser)} disabled={busy}><ShieldCheck size={18}/> {selectedUser.role === "admin" ? "Odebrat roli admin" : "Přidat jako admin"}</button>
              <button type="button" className={`admin-action-button ${selectedUser.blocked ? "" : "admin-action-warning"}`} onClick={() => void handleBlock(selectedUser)} disabled={busy}>{selectedUser.blocked ? <UserCheck size={18}/> : <Ban size={18}/>} {selectedUser.blocked ? "Odblokovat uživatele" : "Zablokovat uživatele"}</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/records`)}><Footprints size={18}/> Zobrazit záznamy</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/gallery`)}><Camera size={18}/> Zobrazit galerii</button>
              <button type="button" className="admin-action-button admin-action-danger" onClick={() => void handleDeleteData(selectedUser)} disabled={busy}><Trash2 size={18}/> Smazat data aktivit</button>
              <button type="button" className="admin-action-button admin-action-danger admin-delete-account-button" onClick={() => void handleDeleteAccount(selectedUser)} disabled={busy}><Trash2 size={18}/> Smazat účet a všechna data</button>
            </div>

            <p className="admin-muted admin-note">Úplné smazání používá serverovou Firebase Admin vrstvu. Po nastavení serverových proměnných ve Vercelu odstraní přihlášení, profil i aktivity uživatele. Fotografie uložené mimo Firebase (Cloudinary) se touto operací zatím nemažou.</p>
          </section>
        )}
      </main>
    </>
  );
}
