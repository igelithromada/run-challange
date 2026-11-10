"use client";
import { ReactNode, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import useThemeLoader from "./lib/useThemeLoader";
import NetworkStatus from "./components/NetworkStatus";
import { setHapticsEnabled, triggerHaptic } from "./lib/haptics";
import AppToast from "./components/AppToast";

export default function ClientLayout({ children }: { children: ReactNode }) {
  useThemeLoader();

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-haptics-v1");
      if (cached !== null) setHapticsEnabled(cached !== "false");
    } catch {}

    const handleInteraction = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest("button, a, [role='button'], input[type='checkbox'], input[type='radio'], select, summary");
      if (!interactive) return;
      if ((interactive as HTMLButtonElement).disabled) return;
      triggerHaptic("light");
    };

    document.addEventListener("click", handleInteraction, true);
    return () => document.removeEventListener("click", handleInteraction, true);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const defaultNickname = user.email?.split("@")[0] || "uživatel";
      if (!snap.exists()) {
        await setDoc(ref, {
          id:user.uid, email:user.email||"", nickname:defaultNickname, avatarUrl:"", theme:"default",
          customColor:"#36D1DC", hapticsEnabled:true
        });
      } else {
        const data = snap.data() || {};
        if (data.blocked === true) {
          await auth.signOut();
          try { sessionStorage.setItem("dolni-lhota-blocked", "true"); } catch {}
          return;
        }
        const update: Record<string, unknown> = {};
        if (!data.nickname) update.nickname = defaultNickname;
        if (!data.theme) update.theme = "default";
        if (!data.customColor) update.customColor = "#36D1DC";
        if (data.avatarUrl === undefined) update.avatarUrl = "";
        if (data.hapticsEnabled === undefined) update.hapticsEnabled = true;
        if (data.hapticsEnabled !== undefined) {
          setHapticsEnabled(data.hapticsEnabled !== false);
          try { localStorage.setItem("dolni-lhota-haptics-v1", data.hapticsEnabled === false ? "false" : "true"); } catch {}
        }
        if (Object.keys(update).length) await setDoc(ref, update, { merge:true });
      }
    });
    return () => unsubscribe();
  }, []);

  return <><NetworkStatus /><AppToast />{children}</>;
}
