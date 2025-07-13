"use client";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "./lib/firebase";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import RunForm from "./components/RunForm";

export default function Page() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("běh");
  const [showImageId, setShowImageId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      }
    });

    const q = query(
      collection(db, "runs"),
      orderBy("timestamp", "desc"),
      limit(30)
    );
    const unsubscribeRuns = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => (item.type || "běh") === selectedType);
      setRuns(items);
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
      const teamList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(teamList);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRuns();
      unsubTeams();
    };
  }, [selectedType, router]);

  const handleSelect = async (item) => {
    setMenuVisible(false);
    if (item === "logout") {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (err) {
        console.error("Chyba při odhlašování: ", err);
      }
    }
    if (item === "myrun") router.push("/myruns");
    if (item === "teams") router.push("/teams");
    if (item === "settings") router.push("/settings");
    if (item === "statistics") router.push("/statistics"); // přidáno
  };

  const handleUserClick = (uid) => {
    router.push(`/user/${uid}`);
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} />
      <Sidebar
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelect={handleSelect}
      />
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <button
            onClick={() => setSelectedType("běh")}
            style={{
              backgroundColor: selectedType === "běh" ? "orange" : "white",
              border: "1px solid black",
              padding: "8px 16px",
              marginRight: "5px"
            }}
          >
            Běh
          </button>
          <button
            onClick={() => setSelectedType("chůze")}
            style={{
              backgroundColor: selectedType === "chůze" ? "orange" : "white",
              border: "1px solid black",
              padding: "8px 16px"
            }}
          >
            Chůze
          </button>
        </div>

        <h2>Vložit nový záznam</h2>
        <RunForm type={selectedType} />

        <h2 style={{ marginTop: "2rem" }}>
          Poslední záznamy
        </h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {runs.map((run) => {
            const teamName = run.teamId 
              ? teams.find(team => team.id === run.teamId)?.name || "?"
              : null;
            return (
              <li key={run.id} style={{ marginBottom: "1rem" }}>
                <span
                  style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => handleUserClick(run.uid)}
                >
                  {run.nickname || run.email?.split("@")[0] || "Anonym"}
                </span>
                {teamName && <span style={{ marginLeft: "5px", color: "green" }}>({teamName})</span>}
                {" — "}
                🏃 {run.km} km, {run.minuty} min, {run.tempo} min/km
                {run.imageUrl && (
                  <>
                    {showImageId === run.id ? (
                      <>
                        <img 
                          src={run.imageUrl} 
                          alt="běh fotka"
                          style={{ maxWidth: "300px", display: "block", margin: "10px auto" }} 
                        />
                        <button 
                          onClick={() => setShowImageId(null)}
                          style={{ marginTop: "5px", backgroundColor: "gray", color: "white", border: "none", borderRadius: "3px", padding: "3px 8px" }}
                        >
                          Zavřít fotku
                        </button>
                      </>
                    ) : (
                      <span 
                        style={{ cursor: "pointer", marginLeft: "5px" }}
                        onClick={() => setShowImageId(run.id)}
                        title="Zobrazit fotku"
                      >
                        📷
                      </span>
                    )}
                  </>
                )}
                <br />
                <small style={{ color: "#555" }}>
                  {run.timestamp?.toDate
                    ? run.timestamp.toDate().toLocaleString("cs-CZ")
                    : new Date(run.timestamp?.seconds ? run.timestamp.seconds * 1000 : run.timestamp).toLocaleString("cs-CZ")}
                </small>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}