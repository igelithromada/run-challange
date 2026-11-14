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
      const testMode = localStorage.getItem("dolni-lhota-weather-test-v1");
      if (testMode) {
        document.documentElement.setAttribute("data-weather", testMode);
        document.documentElement.setAttribute("data-windy", testMode === "wind" ? "true" : "false");
      }
    } catch {}
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

  // Globální chování formulářů na mobilu: aktivní pole se při otevření
  // klávesnice automaticky přesune do viditelné části obrazovky. Platí
  // pro RunForm i ostatní formuláře v aplikaci.
  useEffect(() => {
    const scrollActiveFieldIntoView = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !active.matches("input, textarea, select")) return;

      const scrollParent = (() => {
        let node = active.parentElement;
        while (node && node !== document.body) {
          const style = window.getComputedStyle(node);
          const canScroll = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
          if (canScroll) return node;
          node = node.parentElement;
        }
        return null;
      })();

      const viewport = window.visualViewport;
      const topInset = 72;
      const bottomInset = 20;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;

      const rect = active.getBoundingClientRect();
      let delta = 0;
      if (rect.bottom > viewportBottom - bottomInset) {
        delta = rect.bottom - (viewportBottom - bottomInset);
      } else if (rect.top < viewportTop + topInset) {
        delta = rect.top - (viewportTop + topInset);
      }

      if (Math.abs(delta) < 4) return;

      if (scrollParent) {
        scrollParent.scrollBy({ top: delta, behavior: "smooth" });
      } else {
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
    };

    const handleFocus = () => {
      window.setTimeout(scrollActiveFieldIntoView, 80);
      window.setTimeout(scrollActiveFieldIntoView, 260);
    };

    const handleViewportChange = () => {
      if (document.activeElement?.matches("input, textarea, select")) {
        window.setTimeout(scrollActiveFieldIntoView, 30);
      }
    };

    document.addEventListener("focusin", handleFocus);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", handleViewportChange);
    viewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      viewport?.removeEventListener("resize", handleViewportChange);
      viewport?.removeEventListener("scroll", handleViewportChange);
    };
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
      <div className="app-content-layer">
        <NetworkStatus />
        <AppToast />
        {children}
      </div>
    </>
  );
}
