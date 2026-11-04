"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ArrowLeft, Camera, ShieldCheck, User, Footprints } from "lucide-react";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";
import useAdminGuard from "../lib/useAdminGuard";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

type User = { id: string; nickname: string; email: string; role?: string };

export default function AdminPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const adminAccess = useAdminGuard();

  useEffect(() => {
    if (adminAccess !== "allowed") return;
    let active = true;
    setLoading(true);
    getDocs(collection(db, "users"))
      .then(snapshot => {
        if (!active) return;
        const list: User[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { id: docSnap.id, nickname: data.nickname || "", email: data.email || "", role: data.role };
        });
        list.sort((a, b) => (a.nickname || a.email).localeCompare(b.nickname || b.email, "cs"));
        setUsers(list);
      })
      .catch(() => active && setError("Seznam uživatelů se nepodařilo načíst."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [adminAccess]);

  const handleToggleAdmin = async (user: User) => {
    setBusy(true);
    setError("");
    const newRole = user.role === "admin" ? "" : "admin";
    try {
      await updateDoc(doc(db, "users", user.id), { role: newRole });
      setUsers(prev => prev.map(item => item.id === user.id ? { ...item, role: newRole } : item));
      setSelectedUser(current => current?.id === user.id ? { ...current, role: newRole } : current);
    } catch {
      setError("Roli se nepodařilo změnit.");
    } finally {
      setBusy(false);
    }
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
          <p>Uživatelé, role a jejich aktivity na jednom místě.</p>
        </header>

        {error && <p className="form-message form-message-error" role="alert">{error}</p>}

        {!selectedUser ? (
          <section className="tile admin-users">
            <div className="admin-section-heading"><ShieldCheck size={21} /><div><h2>Uživatelé</h2><span>{users.length} účtů</span></div></div>
            {loading ? <p className="admin-muted">Načítám uživatele…</p> : users.length === 0 ? <p className="admin-muted">Žádní uživatelé nebyli nalezeni.</p> : (
              <div className="admin-user-list">
                {users.map(user => (
                  <button type="button" className="admin-user-row" key={user.id} onClick={() => setSelectedUser(user)}>
                    <span className="admin-user-avatar"><User size={19} /></span>
                    <span className="admin-user-copy"><strong>{user.nickname || "Beze jména"}</strong><small>{user.email}</small></span>
                    {user.role === "admin" && <span className="admin-role">ADMIN</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="tile admin-detail">
            <button type="button" className="admin-back-button" onClick={() => setSelectedUser(null)}><ArrowLeft size={17} /> Zpět na seznam</button>
            <div className="admin-detail-heading">
              <span className="admin-user-avatar large"><User size={25} /></span>
              <div><h2>{selectedUser.nickname || "Beze jména"}</h2><p>{selectedUser.email}</p></div>
            </div>
            <div className="admin-actions">
              <button type="button" className="admin-action-button" onClick={() => handleToggleAdmin(selectedUser)} disabled={busy}><ShieldCheck size={18} /> {selectedUser.role === "admin" ? "Odebrat roli admin" : "Přidat jako admin"}</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/records`)}><Footprints size={18} /> Zobrazit záznamy</button>
              <button type="button" className="admin-action-button" onClick={() => router.push(`/admin/${selectedUser.id}/gallery`)}><Camera size={18} /> Zobrazit galerii</button>
            </div>
            <p className="admin-muted admin-note">Akce jako blokování nebo mazání účtu nejsou v této verzi napojeny na Firebase Authentication, proto nejsou zobrazené jako falešná tlačítka.</p>
          </section>
        )}
      </main>
    </>
  );
}
