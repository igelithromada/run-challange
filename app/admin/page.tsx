"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    };
    fetchUsers();
  }, []);

  const makeAdmin = async (id: string) => {
    await setDoc(doc(db, "users", id), { role: "admin" }, { merge: true });
    alert("Uživatel povýšen na admina");
  };

  return (
    <div className="container">
      <h1>Administrace uživatelů</h1>
      <ul>
        {users.map((user) => (
          <li key={user.id} style={{ marginBottom: "1rem" }}>
            <strong>{user.nickname || user.email}</strong>
            {user.role === "admin" ? (
              <span style={{ marginLeft: "1rem", color: "green" }}>✅ Admin</span>
            ) : (
              <button style={{ marginLeft: "1rem" }} onClick={() => makeAdmin(user.id)}>
                Povýšit na admina
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
