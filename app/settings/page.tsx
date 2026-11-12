"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { applyTheme } from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";
import { Check, Palette, Sparkles, Clock3, CloudSun, SlidersHorizontal, Smartphone, Bell, Moon, Sun, Square } from "lucide-react";
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
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [defaultActivity, setDefaultActivity] = useState<"běh" | "chůze">("běh");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [trainerNotifications, setTrainerNotifications] = useState({ enabled: false, today: true, tomorrow: true });
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
        setAnimationsEnabled(cached.animationsEnabled !== false);
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
          const remoteAnimations = data.animationsEnabled !== false;
          const remoteHaptics = data.hapticsEnabled !== false;
          let localHaptics: boolean | null = null;
          try {
            const stored = localStorage.getItem("dolni-lhota-haptics-v1");
            if (stored !== null) localHaptics = stored !== "false";
          } catch {}
          let cachedTheme: { theme?: string; customColor?: string; animationsEnabled?: boolean; savedAt?: number } | null = null;
          try {
            cachedTheme = JSON.parse(localStorage.getItem("dolni-lhota-theme-v1") || "null");
          } catch {}
          const cachedSavedAt = typeof cachedTheme?.savedAt === "number" ? cachedTheme.savedAt : 0;
          const remoteSavedAt = data.themeUpdatedAt instanceof Date ? data.themeUpdatedAt.getTime() : data.themeUpdatedAt && "toDate" in data.themeUpdatedAt && typeof data.themeUpdatedAt.toDate === "function" ? data.themeUpdatedAt.toDate().getTime() : data.themeUpdatedAt && "seconds" in data.themeUpdatedAt && typeof data.themeUpdatedAt.seconds === "number" ? data.themeUpdatedAt.seconds * 1000 : Number(data.themeUpdatedAt || 0);
          const useRemoteTheme = cachedSavedAt === 0 || remoteSavedAt >= cachedSavedAt;
          const storedTheme = useRemoteTheme ? remoteTheme : (cachedTheme?.theme || remoteTheme);
          const storedColor = useRemoteTheme ? remoteColor : (cachedTheme?.customColor || remoteColor);
          const storedAnimations = useRemoteTheme ? remoteAnimations : (cachedTheme?.animationsEnabled !== false);
          
          setTheme(storedTheme);
          setCustomColor(storedColor);
          setAnimationsEnabled(storedAnimations);
          const effectiveHaptics = localHaptics ?? remoteHaptics;
          setHapticsEnabledState(effectiveHaptics);
          setHapticsEnabled(effectiveHaptics);
          const remoteDefaultActivity = data.defaultActivity === "chůze" ? "chůze" : "běh";
          setDefaultActivity(remoteDefaultActivity);
          const remoteNotifications = data.trainerNotifications || {};
          setTrainerNotifications({
            enabled: remoteNotifications.enabled === true,
            today: remoteNotifications.today !== false,
            tomorrow: remoteNotifications.tomorrow !== false
          });
          try { localStorage.setItem(DEFAULT_ACTIVITY_KEY, remoteDefaultActivity); } catch {}
          await applyTheme(storedTheme, storedColor, storedAnimations, false);
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
      const themeChanged = "theme" in patch || "customColor" in patch || "animationsEnabled" in patch;
      await saveUserSettings(activeUserId, {
        nickname, avatarUrl, theme, customColor, animationsEnabled, ...patch,
      }, themeChanged);
      await mergePublicProfile(activeUserId, {
        nickname: typeof patch.nickname === "string" ? patch.nickname : nickname,
        avatarUrl: typeof patch.avatarUrl === "string" ? patch.avatarUrl : avatarUrl,
        activityType: defaultActivity,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (selectedTheme: string) => {
    setTheme(selectedTheme);
    await applyTheme(selectedTheme, customColor, animationsEnabled);
    await saveSettings({ theme: selectedTheme });
    flash("Vzhled uložen");
  };

  const handleCustomColorLiveChange = async (color: string) => {
    setCustomColor(color);
    setTheme("custom");
    await applyTheme("custom", color, animationsEnabled);
  };

  const handleCustomColorFinalSave = async () => {
    await saveSettings({ theme: "custom", customColor });
    setShowColorPicker(false);
    flash("Vlastní vzhled uložen");
  };

  const handleAnimationsChange = async (enabled: boolean) => {
    setAnimationsEnabled(enabled);
    await applyTheme(theme, customColor, enabled);
    await saveSettings({ animationsEnabled: enabled });
    flash(enabled ? "Animace zapnuty" : "Animace vypnuty");
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

  const updateTrainerNotifications = async (patch: Partial<typeof trainerNotifications>) => {
    const previous = trainerNotifications;
    const next = { ...previous, ...patch };
    setTrainerNotifications(next);
    try {
      await persistTrainerNotifications(next);
      showAppToast("Nastavení notifikací uloženo.");
    } catch (error) {
      setTrainerNotifications(previous);
      showAppToast(error instanceof Error ? error.message : "Nastavení notifikací se nepodařilo uložit.", "error");
    }
  };

  const enableTrainerNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    try {
      await registerTrainerPush();
      const next = { ...trainerNotifications, enabled: true };
      setTrainerNotifications(next);
      await persistTrainerNotifications(next);
      showAppToast("Notifikace osobního trenéra jsou zapnuté.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Notifikace se nepodařilo zapnout.", "error");
    } finally {
      setNotificationBusy(false);
    }
  };

  const disableTrainerNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    try {
      await removeTrainerPush();
      const next = { ...trainerNotifications, enabled: false };
      setTrainerNotifications(next);
      await persistTrainerNotifications(next);
      showAppToast("Notifikace osobního trenéra jsou vypnuté.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Notifikace se nepodařilo vypnout.", "error");
    } finally {
      setNotificationBusy(false);
    }
  };

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
            <input type="checkbox" checked={animationsEnabled} onChange={e => void handleAnimationsChange(e.target.checked)} />
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
            <button type="button" className="custom-theme-trigger" onClick={() => { setShowColorPicker(v => !v); setTheme("custom"); void applyTheme("custom", customColor, animationsEnabled); }}>
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

        <section className="tile">
          <div className="settings-section-heading"><Bell size={21}/><div><h2>Notifikace osobního trenéra</h2><p>Dostávej upozornění na dnešní nebo zítřejší naplánovaný trénink.</p><p className="settings-notification-times">Dnešní plán: kolem 7:00 · Zítřejší plán: kolem 18:00 (časové pásmo ČR)</p></div></div>
          {!trainerNotifications.enabled ? (
            <button type="button" className="tile-button settings-save-button" onClick={() => void enableTrainerNotifications()} disabled={notificationBusy}>
              {notificationBusy ? "Zapínám…" : "Povolit notifikace"}
            </button>
          ) : (
            <>
              <label className="settings-animation-toggle">
                <span><strong>Dnešní plán</strong><small>Ranní upozornění, pokud máš na dnešek naplánovaný trénink.</small></span>
                <input type="checkbox" checked={trainerNotifications.today} onChange={e => void updateTrainerNotifications({ today: e.target.checked })} disabled={notificationBusy} />
              </label>
              <label className="settings-animation-toggle">
                <span><strong>Zítřejší plán</strong><small>Večerní upozornění na trénink naplánovaný na další den.</small></span>
                <input type="checkbox" checked={trainerNotifications.tomorrow} onChange={e => void updateTrainerNotifications({ tomorrow: e.target.checked })} disabled={notificationBusy} />
              </label>
              <button type="button" className="tile-button settings-save-button" onClick={() => void disableTrainerNotifications()} disabled={notificationBusy}>
                {notificationBusy ? "Vypínám…" : "Vypnout notifikace"}
              </button>
            </>
          )}
        </section>

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
