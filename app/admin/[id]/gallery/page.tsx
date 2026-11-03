"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../../lib/firebase";
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";
import useAdminGuard from "../../../lib/useAdminGuard";

type GalleryPhoto = {
  id: string;
  photoUrl: string;
  date: string;
};

export default function GalleryPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const adminAccess = useAdminGuard();
  const [menuVisible, setMenuVisible] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (adminAccess !== "allowed" || !id) return;

    let active = true;
    const fetchPhotos = async () => {
      setLoading(true);
      setError("");
      try {
        const runsQuery = query(collection(db, "runs"), where("uid", "==", id));
        const snapshot = await getDocs(runsQuery);
        const userPhotos: GalleryPhoto[] = [];

        snapshot.forEach((runDoc) => {
          const data = runDoc.data();
          const imageUrls: string[] = Array.isArray(data.imageUrls)
            ? data.imageUrls.filter(
                (url: unknown): url is string => typeof url === "string" && url.length > 0
              )
            : [];

          if (
            imageUrls.length === 0 &&
            typeof data.imageUrl === "string" &&
            data.imageUrl.length > 0
          ) {
            imageUrls.push(data.imageUrl);
          }

          const seconds = data.timestamp?.seconds;
          const date = typeof seconds === "number"
            ? new Date(seconds * 1000).toLocaleString("cs-CZ")
            : "Neznámé datum";

          imageUrls.forEach((photoUrl, index) => {
            userPhotos.push({
              id: `${runDoc.id}-${index}`,
              photoUrl,
              date,
            });
          });
        });

        userPhotos.sort((a, b) => {
          const parseDate = (value: string) => {
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
          };
          return parseDate(b.date) - parseDate(a.date);
        });

        if (active) setPhotos(userPhotos);
      } catch (err) {
        console.error("Nepodařilo se načíst galerii:", err);
        if (active) setError("Galerii se nepodařilo načíst.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchPhotos();
    return () => {
      active = false;
    };
  }, [adminAccess, id]);

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "admin") router.push("/admin");
    else router.push("/");
  };

  if (adminAccess !== "allowed") {
    return <div className="container"><p>Ověřuji administrátorská oprávnění…</p></div>;
  }

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Galerie uživatele</h1>
        {loading && <p>Načítám galerii…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && photos.length === 0 && (
          <p>Uživatel zatím nemá žádné fotografie.</p>
        )}
        {photos.map((photo) => (
          <div key={photo.id} style={{ marginBottom: "1rem" }}>
            <p style={{ fontWeight: "bold" }}>{photo.date}</p>
            <img
              src={photo.photoUrl}
              alt="Fotografie běžeckého záznamu"
              loading="lazy"
              style={{
                width: "100%",
                maxWidth: "400px",
                borderRadius: "12px",
                boxShadow: "0 0 10px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
