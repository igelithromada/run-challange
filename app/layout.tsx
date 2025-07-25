// app/layout.tsx
"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const metadata = {
  title: "Dolní Lhota v pohybu",
  description: "Běžecká výzva Dolní Lhota"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
          await setDoc(userDocRef, {
            nickname: user.email?.split("@")[0] || "Uživatel",
            avatarUrl: "",
            theme: "default"
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <html lang="cs">
      <body>
        {children}
      </body>
    </html>
  );
}
