"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function UserRunsPage() {
  const params = useParams();
  const userId = params.id;

  const [runs, setRuns] = useState([]);
  const [showImageId, setShowImageId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, "runs"), where("uid", "==", userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRuns(data);
    });

    return () => unsubscribe();
  }, [userId]);

  // zjisti nickname z prvního běhu
  const userName = runs.length > 0
    ? (runs[0].nickname || runs[0].email?.split("@")[0] || "neznámý uživatel")
    : "";

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Aktivity uživatele {userName}</h1>
      <button 
        onClick={() => router.push("/")}
        style={{
          marginBottom: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#f0ad4e",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          color: "white"
        }}
      >
        ← Zpět na hlavní stránku
      </button>

      {runs.length === 0 && <p>Tento uživatel zatím nemá žádné záznamy.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {runs.map(run => (
          <li key={run.id} style={{ marginBottom: "1rem" }}>
            🏃 {run.km} km, {run.minuty} min, {run.tempo} min/km <br />
            <small style={{ color: "#555" }}>
              {run.timestamp?.toDate?.()
                ? run.timestamp.toDate().toLocaleString("cs-CZ")
                : new Date(run.timestamp?.seconds ? run.timestamp.seconds * 1000 : run.timestamp).toLocaleString("cs-CZ")}
            </small>
            {run.imageUrl && (
              <div>
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
                    style={{ marginLeft: "10px", cursor: "pointer", color: "blue" }}
                    onClick={() => setShowImageId(run.id)}
                  >
                    📷
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}