"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { getUserProfile } from "./services/users";

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
        const [tokenResult, profile] = await Promise.all([
          user.getIdTokenResult(),
          getUserProfile(user.uid),
        ]);

        const isAdmin = tokenResult.claims.admin === true || profile?.role === "admin";

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
