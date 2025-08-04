"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";

type Run = {
  id: string;
  photos?: string[];
  date: string;
};

export default function GalleryPage() {
  const { id } = useParams();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!id) return;
      const q = query(collection(db, "runs"), where("userId", "==", id));
      const snapshot = await getDocs(q);
      const userRuns: Run[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userRuns.push({
          id: doc.id,
          photos: data.photos || [],
          date: data.datum || "neznámé datum",
        });
      });
      setRuns(userRuns);
    };

    fetchPhotos();
  }, [id]);

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => {}} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={() => {}} />

      <div className="container">
        <h1 className="centered-title">Galerie uživatele</h1>
        {runs.flatMap((run) =>
          (run.photos || []).map((photoUrl, index) => (
            <div key={`${run.id}-${index}`} style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: "bold" }}>{run.date}</p>
              <img
                src={photoUrl}
                alt={`Foto ${index + 1}`}
                style={{
                  width: "100%",
                  maxWidth: "400px",
                  borderRadius: "12px",
                  boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                }}
              />
            </div>
          ))
        )}
      </div>
    </>
  );
}
