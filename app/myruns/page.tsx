"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import useThemeLoader from "../../lib/useThemeLoader";
import { useAuth } from "../../lib/auth";

type RunData = {
  id: string;
  timestamp?: { seconds: number };
  km?: number;
  minuty?: number;
  tempo?: number | string;
  type?: string;
  teamId?: string;
  imageUrls?: string[];
  imageUrl?: string;
};

export default function MyRunsPage() {
  useThemeLoader();
  const { user } = useAuth();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [teams, setTeams] = useState<{ id: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchData = async () => {
      try {
        const [runsSnap, teamsSnap] = await Promise.all([
          getDocs(query(collection(db, "runs"), where("uid", "==", user.uid))),
          getDocs(collection(db, "teams")),
        ]);

        const fetchedRuns = runsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RunData[];

        const sortedRuns = fetchedRuns.sort(
          (a, b) =>
            (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        );

        const fetchedTeams = teamsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setRuns(sortedRuns);
        setTeams(fetchedTeams);
        setLoading(false);
      } catch (err) {
        console.error("Chyba při načítání:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.uid]);

  const handleSelect = (item: string) => {
    setMenuVisible(false);
    if (item === "logout") router.push("/login");
    else if (item === "myruns") window.location.href = "/myruns";
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else router.push("/");
  };

  const formatTime = (minutes?: number | string) => {
    const totalSeconds = Math.round(parseFloat(minutes as string) * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  if (loading) return <div style={{ padding: 20 }}>⏳ Načítání záznamů...</div>;

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Moje aktivity</h1>

        {runs.length === 0 ? (
          <p>Nemáš žádné záznamy.</p>
        ) : (
          <div className="list-container" style={{ gap: "0", display: "flex", flexDirection: "column" }}>
            {runs.map((run) => {
              const teamName = run.teamId ? teams.find(t => t.id === run.teamId)?.name || "?" : null;
              const dateStr = new Date((run.timestamp?.seconds || 0) * 1000).toLocaleString("cs-CZ", {
                hour: "2-digit", minute: "2-digit", year: "numeric", month: "numeric", day:
