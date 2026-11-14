"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { applyTheme } from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";
import { Check, Palette, Sparkles, Clock3, CloudSun, SlidersHorizontal, Smartphone, Bell, Heart, MessageCircle, Moon, Sun, Square } from "lucide-react";
import { registerTrainerPush, removeTrainerPush } from "../lib/pushNotifications";
import { showAppToast } from "../components/AppToast";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";
import { setHapticsEnabled } from "../lib/haptics";
import { invalidatePublicProfileCache, mergePublicProfile } from "../lib/services/publicProfiles";
import { getUserProfile, saveUserSettings } from "../lib/services/users";

const DEFAULT_COLOR = "#36D1DC";
const DEFAULT_ACTIVITY_KEY = "dolni-lhota-default-activity-v1";

export default function SettingsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState("default");
  const [customColor, setCustomColor] = useState(DEFAULT_COLOR);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [defaultActivity, setDefaultActivity] = useState<"běh" | "chůze">("běh");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [trainerNotifications, setTrainerNotifications] = useState({ enabled: false, today: true, tomorrow: true, todayTime: "07:00", tomorrowTime: "18:00" });
  const [socialNotifications, setSocialNotifications] = useState({ likes: true, comments: true });
  const [notificationBusy, setNotificationBusy] = useState(false);

  const router = useRouter();

  useEffect(() => {
    try {
      const cachedActivity = localStorage.getItem(DEFAULT_ACTIVITY_KEY);
      if (cachedActivity === "běh" || cachedActivity === "chůze") setDefaultActivity(cachedActivity);
      const cachedHaptics = localStorage.getItem("dolni-lhota-haptics-v1");
      if (cachedHaptics !== null) setHapticsEnabledState(cachedHaptics !== "false");
      const cached = JSON.parse(localStorage.getItem("dolni-lhota-theme-v1") || "null");
      if (cached) {
        setTheme(cached.theme || "default");
        setCustomColor(cached.customColor || DEFAULT_COLOR);
        setGradientEnabled(cached.gradientEnabled !== false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.uid);
      setEmail(user.email || "");
      try {
        const data = await getUserProfile(user.uid);
        if (data) {
          const remoteTheme = data.theme || "default";
          const remoteColor = data.customColor || DEFAULT_COLOR;
          const remoteGradient = data.gradientEnabled !== false;
          const remoteHaptics = data.hapticsEnabled !== false;
          let localHaptics: boolean | null = null;
          try {
            const stored = localStorage.getItem("dolni-lhota-haptics-v1");
            if (stored !== null) localHaptics = stored !== "false";
          } catch {}
          try {
            cachedTheme = JSON.parse(localStorage.getItem("dolni-lhota-theme-v1") || "null");
          } catch {}
          const cachedSavedAt = typeof cachedTheme?.savedAt === "number" ? cachedTheme.savedAt : 0;
          const remoteSavedAt = data.themeUpdatedAt instanceof Date ? data.themeUpdatedAt.getTime() : data.themeUpdatedAt && "toDate" in data.themeUpdatedAt && typeof data.themeUpdatedAt.toDate === "function" ? data.themeUpdatedAt.toDate().getTime() : data.themeUpdatedAt && "seconds" in data.themeUpdatedAt && typeof data.themeUpdatedAt.seconds === "number" ? data.themeUpdatedAt.seconds * 1000 : Number(data.themeUpdatedAt || 0);
          const useRemoteTheme = cachedSavedAt === 0 || remoteSavedAt >= cachedSavedAt;
          const storedTheme = useRemoteTheme ? remoteTheme : (cachedTheme?.theme || remoteTheme);
          const storedColor = useRemoteTheme ? remoteColor : (cachedTheme?.customColor || remoteColor);
          const storedGradient = useRemoteTheme ? remoteGradient : (cachedTheme?.gradientEnabled !== false);
          
          setTheme(storedTheme);
          setCustomColor(storedColor);
          setGradientEnabled(storedGradient);
          const effectiveHaptics = localHaptics ?? remoteHaptics;
          setHapticsEnabledState(effectiveHaptics);
          setHapticsEnabled(effectiveHaptics);
          const remoteDefaultActivity = data.defaultActivity === "chůze" ? "chůze" : "běh";
          setDefaultActivity(remoteDefaultActivity);
          const remoteSocial = data.socialNotifications || {};
          setSocialNotifications({ likes: remoteSocial.likes !== false, comments: remoteSocial.comments !== false });
          const remoteNotifications = data.trainerNotifications || {};
          setTrainerNotifications({
            enabled: remoteNotifications.enabled === true,
            today: remoteNotifications.today !== false,
            tomorrow: remoteNotifications.tomorrow !== false,
            todayTime: typeof remoteNotifications.todayTime === "string" ? remoteNotifications.todayTime : "07:00",
            tomorrowTime: typeof remoteNotifications.tomorrowTime === "string" ? remoteNotifications.tomorrowTime : "18:00"
          });
          try { localStorage.setItem(DEFAULT_ACTIVITY_KEY, remoteDefaultActivity); } catch {}
        }
      } catch (error) {
        console.error("Nepodařilo se načíst nastavení:", error);
      }
    });
    return () => unsub();
  }, [router]);

  const flash = (message: string, type: "success" | "error" | "info" = "success") => {
    showAppToast(message, type);
  };

  const saveSettings = async (patch: Record<string, unknown>) => {
    const activeUserId = userId || auth.currentUser?.uid;
    if (!activeUserId) throw new Error("Nejsi přihlášen.");
    setSaving(true);
    try {
      await saveUserSettings(activeUserId, {
      }, themeChanged);
      if ("defaultActivity" in patch) {
        await mergePublicProfile(activeUserId, { activityType: defaultActivity });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (selectedTheme: string) => {
    setTheme(selectedTheme);
    await saveSettings({ theme: selectedTheme });
    flash("Vzhled uložen");
  };

  const handleCustomColorLiveChange = async (color: string) => {
    setCustomColor(color);
    setTheme("custom");
  };

  const handleCustomColorFinalSave = async () => {
    await saveSettings({ theme: "custom", customColor });
    setShowColorPicker(false);
    flash("Vlastní vzhled uložen");
  };

  const handleGradientChange = async (enabled: boolean) => {
    setGradientEnabled(enabled);
    try {
      await saveSettings({ gradientEnabled: enabled });
      flash(enabled ? "Gradient zapnutý" : "Gradient vypnutý");
    } catch (error) {
      console.error("Nepodařilo se uložit gradient", error);
      flash("Nastavení gradientu se nepodařilo uložit", "error");
    }
  };

  const handleHapticsChange = async (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    setHapticsEnabled(enabled);
    try { localStorage.setItem("dolni-lhota-haptics-v1", enabled ? "true" : "false"); } catch {}
    try {
      await saveSettings({ hapticsEnabled: enabled });
      flash(enabled ? "Haptická odezva zapnuta" : "Haptická odezva vypnuta");
    } catch (error) {
      console.error("Nepodařilo se uložit haptickou odezvu", error);
      flash("Nastavení haptiky se nepodařilo uložit");
    }
  };

  const handleDefaultActivityChange = async (value: "běh" | "chůze") => {
    const activeUserId = userId || auth.currentUser?.uid;
    const currentUser = auth.currentUser;
    if (!activeUserId || !currentUser) {
      flash("Nejsi přihlášen.");
      return;
    }
    setSaving(true);
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/settings/default-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ defaultActivity: value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Výchozí aktivitu se nepodařilo uložit.");
      setDefaultActivity(value);
      try { localStorage.setItem(DEFAULT_ACTIVITY_KEY, value); } catch {}
      flash(value === "běh" ? "Výchozí aktivita: běh" : "Výchozí aktivita: chůze");
    } catch (error) {
      console.error("Nepodařilo se uložit výchozí aktivitu", error);
      flash(error instanceof Error ? error.message : "Výchozí aktivitu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  };

  const updateSocialNotifications = async (patch: Partial<typeof socialNotifications>) => {
    const previous = socialNotifications;
    const next = { ...previous, ...patch };
    setSocialNotifications(next);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/settings/social-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ socialNotifications: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Nastavení upozornění se nepodařilo uložit.");
      showAppToast("Nastavení upozornění uloženo.");
    } catch (error) {
      setSocialNotifications(previous);
      showAppToast(error instanceof Error ? error.message : "Nastavení upozornění se nepodařilo uložit.", "error");
    }
  };

  const persistTrainerNotifications = async (next: typeof trainerNotifications) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Nejsi přihlášen.");
    const token = await currentUser.getIdToken(true);
    const response = await fetch("/api/settings/trainer-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trainerNotifications: next })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Nastavení notifikací se nepodařilo uložit.");
  };

  const updateTrainerDay = async (mode: "today" | "tomorrow", patch: { enabled?: boolean; time?: string }) => {
    if (notificationBusy) return;
    const previous = trainerNotifications;
    const next = {
      ...previous,
      ...(patch.enabled !== undefined ? { [mode]: patch.enabled } : {}),
      ...(patch.time !== undefined ? { [mode === "today" ? "todayTime" : "tomorrowTime"]: patch.time } : {}),
    } as typeof trainerNotifications;
    const shouldBeEnabled = next.today || next.tomorrow;
    setTrainerNotifications({ ...next, enabled: shouldBeEnabled });
    setNotificationBusy(true);
    try {
      if (patch.enabled === true && !previous.enabled) await registerTrainerPush();
      if (patch.enabled === false && !next.today && !next.tomorrow) await removeTrainerPush();
      await persistTrainerNotifications({ ...next, enabled: shouldBeEnabled });
      showAppToast("Nastavení notifikací uloženo.");
    } catch (error) {
      setTrainerNotifications(previous);
      showAppToast(error instanceof Error ? error.message : "Nastavení notifikací se nepodařilo uložit.", "error");
    } finally {
      setNotificationBusy(false);
    }
  };

  const socialNotificationSection = (
    <section className="tile settings-notification-section">
      <div className="settings-section-heading"><Bell size={21} /><div><h2>Upozornění</h2><p>Vyber, na co chceš upozornění během používání aplikace.</p></div></div>
      <label className="settings-notification-row">
        <span className="settings-notification-copy"><span className="settings-notification-title"><Heart size={18} /> To se mi líbí</span><small>Upozorni mě, když někdo označí můj záznam.</small></span>
        <input type="checkbox" checked={socialNotifications.likes} onChange={e => void updateSocialNotifications({ likes: e.target.checked })} />
      </label>
      <label className="settings-notification-row">
        <span className="settings-notification-copy"><span className="settings-notification-title"><MessageCircle size={18} /> Komentáře</span><small>Upozorni mě, když někdo okomentuje můj záznam.</small></span>
        <input type="checkbox" checked={socialNotifications.comments} onChange={e => void updateSocialNotifications({ comments: e.target.checked })} />
      </label>
    </section>
  );

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) { flash("Nové heslo musí mít alespoň 6 znaků."); return; }
    if (newPassword !== newPasswordConfirm) { flash("Nová hesla se neshodují."); return; }
    if (!auth.currentUser) { flash("Nejsi přihlášen."); return; }
    setPasswordSaving(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword("");
      setNewPasswordConfirm("");
      flash("Heslo bylo změněno.");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code || "") : "";
      flash(code.includes("requires-recent-login") ? "Z bezpečnostních důvodů se nejprve odhlaš a znovu přihlas. Potom změnu hesla zopakuj." : "Heslo se nepodařilo změnit. Zkus to prosím znovu.");
    } finally { setPasswordSaving(false); }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    if (item === "trainer") { router.push("/trainer"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  return (
    <>
      <Navbar title="Nastavení" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <main className="container settings-page">
        <section className="tile">
          <div className="settings-section-heading"><Sparkles size={21}/><div><h2>Vzhled</h2><p>Výběr se ukládá a zůstane zachovaný i po návratu do nastavení.</p></div></div>

          <label className="settings-animation-toggle">
            <span><strong>Animace počasí</strong><small>Efekty počasí i při vlastním barevném vzhledu.</small></span>
          </label>

          <label className="settings-animation-toggle">
            <span><strong>Gradient efekt</strong><small>Plynulý barevný přechod pozadí. Vypnutím zůstane jedna barva.</small></span>
            <input type="checkbox" checked={gradientEnabled} onChange={e => void handleGradientChange(e.target.checked)} />
          </label>

          <div className="theme-options">
            <ThemeItem icon={<Moon size={19}/>} color="#000000" active={theme === "dark"} onClick={() => void handleThemeChange("dark")} text="Čistý černý" />
            <ThemeItem icon={<Sun size={19}/>} color="linear-gradient(180deg,#f7fbff,#dbeafe)" active={theme === "light"} onClick={() => void handleThemeChange("light")} text="Světlý režim" />
            <ThemeItem icon={<Square size={19}/>} color="#ffffff" active={theme === "white"} onClick={() => void handleThemeChange("white")} text="Čistý světlý" />
            <ThemeItem icon={<Palette size={19}/>} color="linear-gradient(180deg,#36D1DC,#5B86E5)" active={theme === "default"} onClick={() => void handleThemeChange("default")} text="Výchozí vzhled" />
            <ThemeItem color="linear-gradient(180deg,#2980b9,#2c3e50)" active={theme === "man"} onClick={() => void handleThemeChange("man")} text="Muž" />
            <ThemeItem color="linear-gradient(180deg,#ff7eb3,#ff758c)" active={theme === "woman"} onClick={() => void handleThemeChange("woman")} text="Žena" />
            <ThemeItem icon={<Clock3 size={19}/>} color="linear-gradient(180deg,#4facfe,#1b2430)" active={theme === "auto"} onClick={() => void handleThemeChange("auto")} text="Podle času" />
            <ThemeItem icon={<CloudSun size={19}/>} color="linear-gradient(180deg,#ffd166,#4facfe)" active={theme === "weather"} onClick={() => void handleThemeChange("weather")} text="Podle počasí" />
          </div>

          <div className={`custom-theme-box ${theme === "custom" ? "active" : ""}`}>
              <span className="theme-color-dot" style={{ background: customColor }} />
              <span><strong>Vlastní barva</strong><small>{customColor.toUpperCase()}</small></span>
              <Check size={19} className={theme === "custom" ? "theme-check" : "theme-check hidden"} />
            </button>
            {showColorPicker && (
              <div className="custom-picker">
                <HexColorPicker color={customColor} onChange={color => void handleCustomColorLiveChange(color)} />
                <button type="button" className="tile-button" onClick={() => void handleCustomColorFinalSave()}>Uložit vlastní barvu</button>
              </div>
            )}
          </div>


        </section>

        <section className="tile">
          <div className="settings-section-heading"><SlidersHorizontal size={21}/><div><h2>Chování aplikace</h2><p>Výchozí typ aktivity pro rychlé přidávání záznamů.</p></div></div>
          <ActivityTypeSelector value={defaultActivity as ActivityType} onChange={(value) => void handleDefaultActivityChange(value)} ariaLabel="Výchozí aktivita" />
        </section>

        <section className="tile settings-notification-section">
          <div className="settings-section-heading"><Bell size={21}/><div><h2>Notifikace osobního trenéra</h2><p>Zapni jen ty typy upozornění, které chceš dostávat, a nastav jejich čas.</p></div></div>
          <label className="settings-notification-row settings-trainer-day-row">
            <span className="settings-notification-copy"><span className="settings-notification-title">Dnešní plán</span><small>Ranní upozornění, pokud máš na dnešek naplánovaný trénink.</small></span>
            <input type="time" className="settings-time-input" step={3600} value={trainerNotifications.todayTime} onChange={e => void updateTrainerDay("today", { time: e.target.value })} disabled={notificationBusy} />
            <input type="checkbox" checked={trainerNotifications.today} onChange={e => void updateTrainerDay("today", { enabled: e.target.checked })} disabled={notificationBusy} aria-label="Zapnout upozornění na dnešní plán" />
          </label>
          <label className="settings-notification-row settings-trainer-day-row">
            <span className="settings-notification-copy"><span className="settings-notification-title">Zítřejší plán</span><small>Večerní upozornění na trénink naplánovaný na další den.</small></span>
            <input type="time" className="settings-time-input" step={3600} value={trainerNotifications.tomorrowTime} onChange={e => void updateTrainerDay("tomorrow", { time: e.target.value })} disabled={notificationBusy} />
            <input type="checkbox" checked={trainerNotifications.tomorrow} onChange={e => void updateTrainerDay("tomorrow", { enabled: e.target.checked })} disabled={notificationBusy} aria-label="Zapnout upozornění na zítřejší plán" />
          </label>
        </section>

        {socialNotificationSection}

        <section className="tile">
          <div className="settings-section-heading"><Smartphone size={21}/><div><h2>Haptická odezva</h2><p>Velmi jemné krátké zavibrování při kliknutí a přepnutí ovládacích prvků.</p></div></div>
          <label className="settings-animation-toggle">
            <span><strong>Haptická odezva</strong><small>Telefon krátce zavibruje při interakci. Nastavení se uloží i pro příště.</small></span>
            <input type="checkbox" checked={hapticsEnabled} onChange={e => void handleHapticsChange(e.target.checked)} />
          </label>
        </section>

      </main>
    </>
  );
}

function ThemeItem({ color, active, onClick, text, icon }: { color: string; active: boolean; onClick: () => void; text: string; icon?: React.ReactNode }) {
  return (
    <button type="button" className={`theme-option ${active ? "active" : ""}`} onClick={onClick}>
      <span className="theme-color-dot" style={{ background: color }}>{icon}</span>
      <span>{text}</span>
      {active && <Check size={18} />}
    </button>
  );
}
