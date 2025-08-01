
"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc,
  deleteDoc, updateDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL
} from "firebase/storage";
import {
  onAuthStateChanged, signOut
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { RunData } from "@/types";

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
      const unsubRuns = onSnapshot(q, (snap) => {
        const items: RunData[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RunData, "id">),
        })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setRuns(items);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError("Chyba při načítání dat.");
        setLoading(false);
      });

      return () => unsubRuns();
    });
  }, [router]);

  const formatTime = (minutes: number) => {
    const totalSeconds = Math.round(minutes * 60);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}′${sec.toString().padStart(2, "0")}″`;
  };

  const filteredRuns = runs.filter(run => {
    if ((run.type || "běh") !== selectedType) return false;
    const date = new Date((run.timestamp?.seconds || 0) * 1000);
    if (dateFrom && new Date(dateFrom) > date) return false;
    if (dateTo && new Date(dateTo + "T23:59") < date) return false;
    return true;
  });

  const totalKm = filteredRuns.reduce((sum, run) => sum + (run.km || 0), 0);
  const totalMin = filteredRuns.reduce((sum, run) => sum + (run.minuty || 0), 0);
  const avgTempo = totalKm ? totalMin / totalKm : 0;
  const totalHours = totalMin / 60;

  const longestRun = filteredRuns.reduce((max, run) => (run.km > (max?.km || 0) ? run : max), null);
  const fastestRun = filteredRuns.reduce((min, run) => (run.tempo < (min?.tempo || Infinity) ? run : min), null);

  const handleDelete = async (id: string) => await deleteDoc(doc(db, "runs", id));

  const handleEdit = (run: RunData) => {
    setEditingId(run.id);
    setKm(run.km.toString());
    setMinuty(run.minuty.toString());
    setFile(null);
  };

  const handleUpdate = async (id: string) => {
    let imageUrl = null;
    if (file) {
      const imageRef = ref(storage, `runs/${id}/${file.name}`);
      await uploadBytes(imageRef, file);
      imageUrl = await getDownloadURL(imageRef);
    }
    const tempo = parseFloat(minuty) / parseFloat(km);
    await updateDoc(doc(db, "runs", id), {
      km: parseFloat(km),
      minuty: parseFloat(minuty),
      tempo: tempo,
      ...(imageUrl && { imageUrl })
    });
    setEditingId(null);
    setFile(null);
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else router.push("/" + item);
  };

  const renderTempoBar = (tempo: number) => {
    const range = selectedType === "chůze" ? { min: 8, max: 20 } : { min: 3, max: 8 };
    let pos = Math.min(100, Math.max(0, ((range.max - tempo) / (range.max - range.min)) * 100));
    return (
      <div style={{ marginTop: "4px" }}>
        <div style={{ fontSize: "0.9rem", marginBottom: "2px" }}>
          {formatTime(tempo)} /km
        </div>
        <div style={{
          height: "5px", width: "70px",
          background: "linear-gradient(90deg, red, yellow, green)",
          borderRadius: "3px", position: "relative"
        }}>
          <div style={{
            position: "absolute",
            top: "-4px",
            left: `${pos}%`,
            width: "10px",
            height: "10px",
            background: "white",
            border: "2px solid #333",
            borderRadius: "50%",
            transform: "translateX(-50%)"
          }} />
        </div>
      </div>
    );
  };

  return <></>; // Šablonu doplníme později
}
