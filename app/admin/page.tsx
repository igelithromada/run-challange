"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    };
    fetchUsers();
  }, []);

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    await setDoc(doc(db, "users", id), { role: isAdmin ? "" : "admin" }, { merge: true });
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: isAdmin ? "" : "admin" } : u))
    );
  };

  const showRuns = async (userId: string) => {
    setSelectedUserId(userId);
    const runsQuery = query(collection(db, "runs"), where("userId", "==", userId));
    const snapshot = await getDocs(runsQuery);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setRuns(data);
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") return router.push("/login");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "admin") router.push("/admin");
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Správa uživatelů</h1>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {users.map((user) => {
            const isAdmin = user.role === "admin";
            return (
              <li key={user.id} style={{ marginBottom: "1rem" }}>
                <strong>{user.nickname || user.email}</strong>
                {isAdmin && <span style={{ marginLeft: "1rem", color: "green" }}>✅ Admin</span>}
                <button style={{ marginLeft: "1rem" }} onClick={() => toggleAdmin(user.id, isAdmin)}>
                  {isAdmin ? "Odebrat admina" : "Povýšit na admina"}
                </button>
                <button style={{ marginLeft: "1rem" }} onClick={() => showRuns(user.id)}>
                  Zobrazit záznamy
                </button>
              </li>
            );
          })}
        </ul>

        {selectedUserId && (
          <>
            <h2>Záznamy uživatele</h2>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {runs.map((run) => (
                <li key={run.id} style={{
                  background: "rgba(255,255,255,0.1)",
                  padding: "1rem",
                  marginBottom: "1rem",
                  borderRadius: "8px"
                }}>
                  <div><strong>Typ:</strong> {run.typ}</div>
                  <div><strong>Vzdálenost:</strong> {run.km} km</div>
                  <div><strong>Čas:</strong> {run.minuty} min {run.sekundy} s</div>
                  <div><strong>Tempo:</strong> {run.tempo}</div>
                  <div><strong>Datum:</strong> {run.datum}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
