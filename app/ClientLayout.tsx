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
        if (!snap.exists()) {
          await setDoc(ref, {
            nickname: user.email?.split("@")[0] || "Uživatel",
            avatarUrl: "",
            theme: "default"
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
