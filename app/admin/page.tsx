"use client";
import React, { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  nickname: string;
  email: string;
  role?: string;
};

export default function AdminPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          nickname: data.nickname || "",
          email: data.email || "",
          role: data.role,
        });
      });
      setUsers(list);
    };
    fetchUsers();
  }, []);

  const handleToggleAdmin = async (user: User) => {
    const newRole = user.role === "admin" ? "" : "admin";
    await updateDoc(doc(db, "users", user.id), { role: newRole });
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
    );
    if (selectedUser) setSelectedUser({ ...selectedUser, role: newRole });
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") router.push("/login");
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
        <h1 className="centered-title">Admin – Správa uživatelů</h1>

        {!selectedUser ? (
          <div className="tile">
            <h3>Seznam uživatelů</h3>
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => setSelectedUser(user)}
                style={{
                  padding: "0.5rem",
                  marginBottom: "0.3rem",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                <strong>{user.nickname || "Beze jména"}</strong> – {user.email} {user.role === "admin" && "🛡️"}
              </div>
            ))}
          </div>
        ) : (
          <div className="tile">
            <h3>{selectedUser.nickname || "Beze jména"}</h3>
            <p>{selectedUser.email}</p>

            <button
              onClick={() => handleToggleAdmin(selectedUser)}
              style={buttonStyle}
            >
              {selectedUser.role === "admin" ? "Odebrat roli admin" : "Přidat jako admin"}
            </button>

            <button
              onClick={() => router.push(`/user/${selectedUser.id}`)}
              style={buttonStyle}
            >
              Zobrazit záznamy
            </button>

            <button
              onClick={() => router.push(`/admin/${selectedUser.id}/gallery`)}
              style={buttonStyle}
            >
              Zobrazit galerii
            </button>

            <button
              onClick={() => alert("Tady bude blokování účtu")}
              style={buttonStyle}
            >
              Zablokovat účet
            </button>

            <button
              onClick={() => alert("Tady bude smazání účtu")}
              style={buttonStyle}
            >
              Smazat účet
            </button>

            <button
              onClick={() => alert("Tady bude reset hesla")}
              style={buttonStyle}
            >
              Reset hesla
            </button>

            <button
              onClick={() => setSelectedUser(null)}
              style={{ ...buttonStyle, background: "rgba(255,255,255,0.2)", color: "white" }}
            >
              Zpět
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const buttonStyle = {
  width: "100%",
  padding: "0.5rem",
  marginTop: "0.4rem",
  borderRadius: "8px",
  border: "none",
  fontWeight: "bold" as const,
  cursor: "pointer",
  background: "white",
  color: "black",
};
