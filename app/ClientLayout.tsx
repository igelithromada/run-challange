"use client";
import { ReactNode, useEffect } from "react";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import useThemeLoader from "./lib/useThemeLoader";
import NetworkStatus from "./components/NetworkStatus";
import { setHapticsEnabled, triggerHaptic } from "./lib/haptics";
import { mergePublicProfile } from "./lib/services/publicProfiles";
import { getUserProfile, mergeUserProfile } from "./lib/services/users";
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

      try {
        const profile = await getUserProfile(user.uid);
        const defaultNickname = user.email?.split("@")[0] || "uživatel";

        if (!profile) {
          await mergeUserProfile(user.uid, {
            email: user.email || "",
            nickname: defaultNickname,
            avatarUrl: "",
            theme: "default",
            customColor: "#36D1DC",
            hapticsEnabled: true
          });
          await mergePublicProfile(user.uid, {
            nickname: defaultNickname,
            avatarUrl: "",
            activityType: "běh"
          });
          return;
        }

        const data = profile;
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
          try {
            localStorage.setItem(
              "dolni-lhota-haptics-v1",
              data.hapticsEnabled === false ? "false" : "true"
            );
          } catch {}
        }

        if (Object.keys(update).length) {
          await mergeUserProfile(user.uid, update);
        }

        await mergePublicProfile(user.uid, {
          nickname: typeof update.nickname === "string"
            ? update.nickname
            : (data.nickname || defaultNickname),
          avatarUrl: typeof update.avatarUrl === "string"
            ? update.avatarUrl
            : (data.avatarUrl || ""),
          activityType: data.defaultActivity === "chůze" ? "chůze" : "běh",
        });
      } catch (error) {
        // Profilová synchronizace nesmí shodit zbytek aplikace.
        // Například při krátkém výpadku Firestore má uživatel stále
        // používat aplikaci a případný problém řeší konkrétní obrazovka.
        console.error("Nepodařilo se synchronizovat profil:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <div className="weather-animation-overlay" aria-hidden="true" />
      <NetworkStatus />
      <AppToast />
      {children}
    </>
  );
}
