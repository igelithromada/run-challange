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

  // ... (zbytek komponenty zůstává beze změny – pokud chceš celý soubor včetně JSX a funkcí jako handleEdit apod., napiš mi a pošlu ho celý).
}
