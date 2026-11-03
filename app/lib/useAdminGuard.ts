"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "./firebase";

type AdminAccess = "loading" | "allowed" | "denied";

export default function useAdminGuard(): AdminAccess {
  const [access, setAccess] = useState<AdminAccess>("loading");
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setAccess("denied");
        router.replace("/login");
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        const isAdmin = userSnapshot.exists() && userSnapshot.data().role === "admin";

        if (!active) return;
        setAccess(isAdmin ? "allowed" : "denied");

        if (!isAdmin) router.replace("/");
      } catch (error) {
        console.error("Nepodařilo se ověřit oprávnění administrátora:", error);
        if (active) setAccess("denied");
        router.replace("/");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  return access;
}
