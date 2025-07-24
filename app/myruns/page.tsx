"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { RunData } from "../types";
import formatTime from "../lib/formatTime"; // Ujisti se, že funkce existuje a importuješ ji správně

export default function MyRunsPage() {
  useThemeLoader();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImageUrl, setShowImageUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("běh");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [minuty, setMinuty] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const q = query(collection(db, "runs"), where("uid", "==", user.uid));
      const unsubRuns = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((doc) => {
              const data = doc.data() as Omit<RunData, "id">;
              return { ...data, id: doc.id };
            })
            .sort(
              (a, b) =>
                (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
            );
          setRuns(items);
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setError("Chyba při načítání dat.");
          setLoading(false);
        }
      );

      return () => unsubRuns();
    });

    return () => unsubAuth();
  }, [router]);

  const filteredRuns = runs.filter((run) => {
    return run.typ === selectedType &&
      (!dateFrom || run.datum >= dateFrom) &&
      (!dateTo || run.datum <= dateTo);
  });

  const totalKm = filteredRuns.reduce(
    (sum, run) => sum + Number(run.km || 0),
    0
  );
  const totalMin = filteredRuns.reduce(
    (sum, run) => sum + Number(run.minuty || 0),
    0
  );
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun: RunData | undefined = filteredRuns.reduce(
    (max, run) => (!max || Number(run.km) > Number(max.km) ? run : max),
    undefined
  );

  const fastestRun: RunData | undefined = filteredRuns.reduce(
    (min, run) => (!min || Number(run.tempo) < Number(min.tempo) ? run : min),
    undefined
  );

  return (
    <>
      <Navbar menuVisible={menuVisible} setMenuVisible={setMenuVisible} />
      <Sidebar menuVisible={menuVisible} />
      <main>
        {loading ? (
          <p>Načítání...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <h1>Moje aktivity</h1>

            <div className="filters">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="běh">běh</option>
                <option value="chůze">chůze</option>
                <option value="kolo">kolo</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="summary">
              <div className="tile">📏 {totalKm} km</div>
              <div className="tile">🕒 {totalHours.toFixed(1)} h</div>
              <div className="tile">⚡ {formatTime(avgTempo)} /km</div>
              {longestRun && (
                <div className="tile">
                  🏆 Nejdelší {selectedType}: {longestRun.km} km za{" "}
                  {formatTime(Number(longestRun.minuty))} (
                  {formatTime(Number(longestRun.tempo))} /km)
                </div>
              )}
              {fastestRun && (
                <div className="tile">
                  🚀 Nejrychlejší {selectedType}: {fastestRun.km} km za{" "}
                  {formatTime(Number(fastestRun.minuty))} (
                  {formatTime(Number(fastestRun.tempo))} /km)
                </div>
              )}
            </div>

            {/* Zde mohou být další části JSX – výpis jednotlivých aktivit, editační formuláře atd. */}
          </>
        )}
      </main>
    </>
  );
}
