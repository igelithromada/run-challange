"use client";

import { ReactNode, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const defaultNickname = user.email?.split("@")[0] || "uživatel";

      if (!snap.exists()) {
        // Dokument neexistuje – vytvoříme ho
        await setDoc(ref, {
          id: user.uid,
          email: user.email || "",
          nickname: defaultNickname,
          avatarUrl: "",
          theme: "default",
          customColor: "#36D1DC",
        });
      } else {
        // Dokument existuje – zkontrolujeme a doplníme chybějící hodnoty
        const data = snap.data() || {};
        const update: Partial<typeof data> = {};

        if (!data.nickname) update.nickname = defaultNickname;
        if (!data.theme) update.theme = "default";
        if (!data.customColor) update.customColor = "#36D1DC";
        if (data.avatarUrl === undefined) update.avatarUrl = "";

        if (Object.keys(update).length > 0) {
          await setDoc(ref, update, { merge: true });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
