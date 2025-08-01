"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { RunData } from "@/types";

export default function MyRunsPage() {
  useThemeLoader();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("běh");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "runs"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubRuns = onSnapshot(q, (snap) => {
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as RunData[];
      setRuns(items);
      setLoading(false);
    });

    return () => unsubRuns();
  }, []);

  const filteredRuns = runs.filter((run) => run.typ === selectedType);
  const totalKm = filteredRuns.reduce((sum, run) => sum + (Number(run.km) || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + (Number(run.minuty) || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun: RunData | null = filteredRuns.reduce(
    (max, run) => (run.km > (max?.km || 0) ? run : max),
    null as RunData | null
  );

  const fastestRun: RunData | null = filteredRuns.reduce(
    (min, run) =>
      parseFloat(run.tempo || "9999") < parseFloat(min?.tempo || "9999") ? run : min,
    null as RunData | null
  );

  const handleDelete = async (id: string) => await deleteDoc(doc(db, "runs", id));

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={(item) => {
        setMenuVisible(false);
        if (item === "logout") auth.signOut();
      }} />
      {/* ...další část UI */}
    </>
  );
}
