"use client";

import { ReactNode, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data();

        const defaultNickname = user.email?.split("@")[0] || "uživatel";
        const newData = {
          id: user.uid,
          email: user.email || "",
          nickname: defaultNickname,
          avatarUrl: "",
          theme: "default",
          customColor: "#36D1DC"
        };

        // Pokud dokument neexistuje, nebo v něm chybí některé hodnoty → doplnit
        if (!snap.exists() || !data?.nickname || !data?.theme || !data?.customColor) {
          await setDoc(ref, newData, { merge: true });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
