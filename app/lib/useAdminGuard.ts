"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { getUserProfile } from "./services/users";

type AdminAccess = "loading" | "allowed" | "denied";

export default function useAdminGuard(redirectOnDenied = true): AdminAccess {
  const [access, setAccess] = useState<AdminAccess>("loading");
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
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

        if (!active || auth.currentUser?.uid !== user.uid) return;
        setAccess(isAdmin ? "allowed" : "denied");

        if (!isAdmin && redirectOnDenied) router.replace("/");
      } catch (error) {
        if (!active || auth.currentUser?.uid !== user.uid) return;
        console.error("Nepodařilo se ověřit oprávnění administrátora:", error);
        if (active) setAccess("denied");
        if (redirectOnDenied) router.replace("/");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router, redirectOnDenied]);

  return access;
}
