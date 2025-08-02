"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "./lib/firebase";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import RunForm from "./components/RunForm";
import useThemeLoader from "./lib/useThemeLoader";
import { RunData } from "./types";

export default function Page() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("běh");
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [imageRunId, setImageRunId] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<{ [key: string]: { avatarUrl: string; nickname: string } }>({});
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });

    const q = query(collection(db, "runs"), orderBy("timestamp", "desc"), limit(30));
    const unsubRuns = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as RunData))
        .filter((item) => (item.type || "běh") === selectedType);
      setRuns(items);
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAuth();
      unsubRuns();
      unsubTeams();
    };
  }, [selectedType, router]);

  useEffect(() => {
    runs.forEach((run) => {
      if (run.uid && !userAvatars[run.uid]) {
        getDoc(doc(db, "users", run.uid)).then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserAvatars((prev) => ({
              ...prev,
              [run.uid]: {
                avatarUrl: data.avatarUrl || "",
                nickname: data.nickname || "",
              },
            }));
          }
        });
      }
    });
  }, [runs]);

  const formatTime = (minutes: string) => {
    const totalSeconds = Math.round(parseFloat(minutes) * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "logout") signOut(auth).then(() => router.push("/login"));
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else router.push("/");
  };

  const showPhotoIcon = (run: RunData) => {
    const hasSingle = typeof run.imageUrl === "string" && run.imageUrl !== "";
    const hasMultiple = Array.isArray(run.imageUrls) && run.imageUrls.length > 0;
    return hasSingle || hasMultiple;
  };

  const handleShowImages = (images: string[], fallback: string, runId: string) => {
    let urls: string[] = [];

    if (Array.isArray(images) && images.length > 0) {
      urls = images;
    } else if (typeof fallback === "string" && fallback !== "") {
      urls = [fallback];
    }

    if (urls.length > 0) {
      setShowImages(urls);
      setCurrentImgIndex(0);
      setImageRunId(runId);
    }
  };

  const handleNext = () => {
    if (showImages) {
      setCurrentImgIndex((currentImgIndex + 1) % showImages.length);
    }
  };

  const handlePrev = () => {
    if (showImages) {
      setCurrentImgIndex((currentImgIndex - 1 + showImages.length) % showImages.length);
    }
  };

  const handleDeleteImage = async () => {
    if (!showImages || imageRunId === null) return;

    const confirmed = confirm("Opravdu chceš tuto fotku smazat?");
    if (!confirmed) return;

    const updatedImages = showImages.filter((_, i) => i !== currentImgIndex);

    try {
      await updateDoc(doc(db, "runs", imageRunId), {
        imageUrls: updatedImages
      });

      if (updatedImages.length === 0) {
        setShowImages(null);
      } else {
        setShowImages(updatedImages);
        setCurrentImgIndex((prev) => (prev >= updatedImages.length ? 0 : prev));
      }
    } catch (err) {
      console.error("Chyba při mazání fotky:", err);
    }
  };

  return (
    <>
      {/* zbytek UI jako dřív */}
      {/* ... */}

      {showImages && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 2000
        }}>
          <div style={{ position: "relative", textAlign: "center" }}>
            <img src={showImages[currentImgIndex]} alt="náhled" style={{
              maxWidth: "90%", maxHeight: "80%", borderRadius: "10px"
            }} />
            <div style={{ marginTop: "1.2rem", display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setShowImages(null)} style={{
                background: "white", color: "black", border: "none",
                borderRadius: "12px", padding: "0.6rem 1.4rem",
                fontWeight: "bold", fontSize: "16px", cursor: "pointer"
              }}>Zavřít</button>
              <button onClick={handleDeleteImage} style={{
                background: "red", color: "white", border: "none",
                borderRadius: "12px", padding: "0.6rem 1.4rem",
                fontWeight: "bold", fontSize: "16px", cursor: "pointer"
              }}>Smazat</button>
            </div>
            {showImages.length > 1 && (
              <div style={{
                position: "absolute", top: "50%", width: "100%", display: "flex",
                justifyContent: "space-between", transform: "translateY(-50%)", padding: "0 1rem"
              }}>
                <button onClick={handlePrev} style={{
                  background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer"
                }}>❮</button>
                <button onClick={handleNext} style={{
                  background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer"
                }}>❯</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
