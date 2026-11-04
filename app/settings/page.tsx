"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { applyTheme } from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";
import { Check, Palette, Sparkles, Clock3 } from "lucide-react";

const DEFAULT_COLOR = "#36D1DC";

export default function SettingsPage() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [theme, setTheme] = useState("default");
  const [customColor, setCustomColor] = useState(DEFAULT_COLOR);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { router.replace("/login"); return; }
      setUserId(user.uid);
      setEmail(user.email || "");
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const storedTheme = data.theme || "default";
          const storedColor = data.customColor || DEFAULT_COLOR;
          const storedAnimations = data.animationsEnabled !== false;
          setNickname(data.nickname || "");
          setAvatarUrl(data.avatarUrl || "");
          setTheme(storedTheme);
          setCustomColor(storedColor);
          setAnimationsEnabled(storedAnimations);
          await applyTheme(storedTheme, storedColor, storedAnimations);
        }
      } catch (error) {
        console.error("Nepodařilo se načíst nastavení:", error);
      }
    });
    return () => unsub();
  }, [router]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const saveSettings = async (patch: Record<string, unknown>) => {
    if (!userId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", userId), {
        nickname, avatarUrl, theme, customColor, animationsEnabled, ...patch
      }, { merge: true });
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

  const handleNicknameSave = async () => {
    const value = nickname.trim();
    if (!value) return;
    await saveSettings({ nickname: value });
    setNickname(value);
    flash("Přezdívka uložena");
  };

  const handleAnimationsChange = async (enabled: boolean) => {
    setAnimationsEnabled(enabled);
    await applyTheme(theme, customColor, enabled);
    await saveSettings({ animationsEnabled: enabled });
    flash(enabled ? "Animace zapnuty" : "Animace vypnuty");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      flash(file.type.startsWith("image/") ? "Fotografie je příliš velká (max. 5 MB)." : "Vyber obrázek.");
      input.value = "";
      return;
    }
    if (!userId) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "lhota_unsigned");
      const response = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Nahrání selhalo.");
      await setDoc(doc(db, "users", userId), { avatarUrl: result.secure_url }, { merge: true });
      setAvatarUrl(result.secure_url);
      flash("Profilová fotografie uložena");
    } catch (error) {
      console.error(error);
      flash("Fotografii se nepodařilo uložit.");
    } finally {
      setAvatarUploading(false);
      input.value = "";
    }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") { await signOut(auth); router.push("/login"); return; }
    if (item === "home") { router.push("/"); return; }
    router.push("/" + (item === "myrun" ? "myruns" : item));
  };

  return (
    <>
      <Navbar title="Nastavení" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <main className="container settings-page">
        <section className="tile">
          <div className="settings-section-heading"><Palette size={21}/><div><h2>Profil</h2><p>Nastavení, které se zobrazí u tvých aktivit.</p></div></div>
          <label className="settings-field-label">Uživatelské jméno
            <input value={nickname} placeholder="Uživatelské jméno" onChange={e => setNickname(e.target.value)} />
          </label>
          <button type="button" className="tile-button settings-save-button" onClick={handleNicknameSave} disabled={saving}>{saving ? "Ukládám…" : "Uložit přezdívku"}</button>
        </section>

        <section className="tile settings-avatar">
          <div className="settings-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="Profilový avatar" /> : <span>{(nickname || email).charAt(0).toUpperCase() || "?"}</span>}
          </div>
          <div className="settings-avatar-copy">
            <h3>Profilová fotografie</h3>
            <p>Vyber obrázek, který se zobrazí u tvých aktivit.</p>
            <label className="avatar-upload-button">
              {avatarUploading ? "Nahrávám obrázek…" : avatarUrl ? "Změnit fotografii" : "Vybrat fotografii"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={avatarUploading} />
            </label>
            <small>JPG, PNG nebo WEBP · maximálně 5 MB</small>
          </div>
        </section>

        <section className="tile">
          <div className="settings-section-heading"><Sparkles size={21}/><div><h2>Vzhled</h2><p>Výběr se ukládá a zůstane zachovaný i po návratu do nastavení.</p></div></div>

          <label className="settings-animation-toggle">
            <span><strong>Animace počasí</strong><small>Efekty počasí i při vlastním barevném vzhledu.</small></span>
            <input type="checkbox" checked={animationsEnabled} onChange={e => void handleAnimationsChange(e.target.checked)} />
          </label>

          <div className="theme-options">
            <ThemeItem icon={<Palette size={19}/>} color="linear-gradient(180deg,#36D1DC,#5B86E5)" active={theme === "default"} onClick={() => void handleThemeChange("default")} text="Výchozí vzhled" />
            <ThemeItem color="linear-gradient(180deg,#2980b9,#2c3e50)" active={theme === "man"} onClick={() => void handleThemeChange("man")} text="Muž" />
            <ThemeItem color="linear-gradient(180deg,#ff7eb3,#ff758c)" active={theme === "woman"} onClick={() => void handleThemeChange("woman")} text="Žena" />
            <ThemeItem icon={<Clock3 size={19}/>} color="linear-gradient(180deg,#4facfe,#1b2430)" active={theme === "auto"} onClick={() => void handleThemeChange("auto")} text="Podle času" />
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

          {notice && <div className="settings-notice" role="status">{notice}</div>}
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
