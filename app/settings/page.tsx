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

export default function SettingsPage() {

  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [theme, setTheme] = useState("default");
  const [customColor, setCustomColor] = useState("#36D1DC");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setEmail(user.email || "");
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNickname(data.nickname || "");
          setAvatarUrl(data.avatarUrl || "");
          setTheme(data.theme || "default");
          setCustomColor(data.customColor || "#36D1DC");
          setAnimationsEnabled(data.animationsEnabled !== false);
          applyTheme(data.theme || "default", data.customColor || "#36D1DC", data.animationsEnabled !== false);
        } else {
          const initialData = {
            id: user.uid,
            email: user.email || "",
            nickname: "",
            avatarUrl: "",
            theme: "default",
            customColor: "#36D1DC",
            animationsEnabled: true
          };
          await setDoc(userRef, initialData);
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  const saveSettings = async (newData = {}) => {
    if (!userId) return;
    await setDoc(doc(db, "users", userId), {
      nickname,
      avatarUrl,
      theme,
      customColor,
      animationsEnabled,
      ...newData
    }, { merge: true });
  };

  const handleThemeChange = (selectedTheme: string) => {
    setTheme(selectedTheme);
    applyTheme(selectedTheme, customColor, animationsEnabled);
    saveSettings({ theme: selectedTheme });
  };

  const handleCustomColorLiveChange = (color: string) => {
    setCustomColor(color);
    setTheme("custom");
    applyTheme("custom", color, animationsEnabled);
  };

  const handleCustomColorFinalSave = () => {
    saveSettings({ theme: "custom", customColor, animationsEnabled });
    setShowColorPicker(false);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  const handleNicknameSave = async () => {
    if (!userId) return;
    setNicknameSaving(true);
    try {
      await saveSettings({ nickname: nickname.trim() });
      setNickname(nickname.trim());
      setShowNotification(true);
      window.setTimeout(() => setShowNotification(false), 2000);
    } catch (error) {
      console.error("Nepodařilo se uložit přezdívku", error);
      alert("Přezdívku se nepodařilo uložit. Zkus to prosím znovu.");
    } finally { setNicknameSaving(false); }
  };

  const handleAnimationsChange = async (enabled: boolean) => {
    setAnimationsEnabled(enabled);
    await applyTheme(theme, customColor, enabled);
    await saveSettings({ animationsEnabled: enabled });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (!userId) {
      alert("Uživatel ještě není načtený. Zkus to prosím znovu.");
      input.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Vyber prosím obrázek.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Avatar může mít maximálně 5 MB.");
      input.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "lhota_unsigned");
      const response = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Nahrání obrázku selhalo.");
      const downloadUrl = result.secure_url;
      setAvatarUrl(downloadUrl);
      await saveSettings({ avatarUrl: downloadUrl });
    } catch (err) {
      console.error("Chyba při nahrávání avataru:", err);
      alert("Avatar se nepodařilo uložit. Zkus to prosím znovu.");
    } finally {
      setAvatarUploading(false);
      input.value = "";
    }
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (err) {
        console.error("Chyba při odhlašování: ", err);
      }
    } else if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "progress") router.push("/progress");
    else if (item === "weather") router.push("/weather");
    else if (item === "admin") router.push("/admin");
  };

  return (
    <>
      <Navbar title="Nastavení" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        

        <div className="tile">
          <h3>Uživatelské jméno</h3>
          <input
            type="text"
            value={nickname}
            placeholder="Uživatelské jméno"
            onChange={(e) => setNickname(e.target.value)}
            style={{
              width: "100%", padding: "0.5rem", borderRadius: "10px",
              border: "none", marginTop: "0.2rem"
            }}
          />
          <button type="button" className="tile-button settings-save-button" onClick={handleNicknameSave} disabled={nicknameSaving}>{nicknameSaving ? "Ukládám…" : "Uložit přezdívku"}</button>
        </div>

        <section className="tile settings-avatar">
          <div className="settings-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="Profilový avatar" /> : <span>{(nickname || email)?.charAt(0).toUpperCase() || "?"}</span>}
          </div>
          <div className="settings-avatar-copy">
            <h3>Profilová fotografie</h3>
            <p>Vyber obrázek, který se zobrazí u tvých aktivit.</p>
            <label className="avatar-upload-button">
              {avatarUploading ? "Nahrávám obrázek…" : avatarUrl ? "Změnit fotografii" : "Vybrat fotografii"}
              <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarUploading} />
            </label>
            <small>JPG, PNG nebo WEBP · maximálně 5 MB</small>
          </div>
        </section>

        <div className="tile">
          <h3>Nastavení vzhledu</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label className="settings-animation-toggle"><span><strong>Animace počasí</strong><small>Efekty deště, sněžení a větru i při vlastním barevném vzhledu.</small></span><input type="checkbox" checked={animationsEnabled} onChange={(e) => handleAnimationsChange(e.target.checked)} /></label>
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "default"} onClick={() => handleThemeChange("default")} text="Výchozí vzhled" />
            <ThemeItem color="linear-gradient(180deg, #2980b9, #2c3e50)" active={theme === "man"} onClick={() => handleThemeChange("man")} text="Muž" />
            <ThemeItem color="linear-gradient(180deg, #ff7eb3, #ff758c)" active={theme === "woman"} onClick={() => handleThemeChange("woman")} text="Žena" />
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "auto"} onClick={() => handleThemeChange("auto")} text="Automaticky podle času" />
            <ThemeItem color="linear-gradient(160deg, #263849, #6bc6dc, #f5b94c)" active={theme === "weather"} onClick={() => handleThemeChange("weather")} text="Google Počasí (záloha Open-Meteo)" />
            <small style={{ opacity: 0.72, lineHeight: 1.4 }}>Google Weather se použije, pokud je na serveru nastavený API klíč. Jinak aplikace automaticky využije Open-Meteo.</small>

            <div style={{
              marginTop: "0.7rem",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "0.5rem"
            }}>
              <div onClick={() => { setShowColorPicker(!showColorPicker); setTheme("custom"); applyTheme("custom", customColor, animationsEnabled); }} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer"
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: customColor, border: "1px solid white"
                  }}></div>
                  <span>Vlastní barva</span>
                </label>
              </div>

              {showColorPicker && (
                <div style={{ marginTop: "0.5rem" }}>
                  <HexColorPicker
                    color={customColor}
                    onChange={handleCustomColorLiveChange}
                    style={{ width: "100%", height: "180px" }}
                  />
                  <button
                    onClick={handleCustomColorFinalSave}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem 1rem",
                      borderRadius: "10px",
                      border: "none",
                      background: "white",
                      color: "#000",
                      fontWeight: "bold",
                      cursor: "pointer",
                      width: "100%"
                    }}
                  >
                    Uložit barvu
                  </button>
                </div>
              )}
              {showNotification && (
                <div style={{
                  marginTop: "0.5rem",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.2)",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: "bold"
                }}>
                  Barva uložena
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const ThemeItem = ({ color, active, onClick, text }: {
  color: string, active: boolean, onClick: () => void, text: string
}) => (
  <div onClick={onClick} style={{
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: active ? "rgba(255,255,255,0.3)" : "transparent",
    borderRadius: "8px",
    padding: "0.5rem"
  }}>
    <div style={{
      width: "20px", height: "20px", borderRadius: "50%",
      background: color
    }}></div>
    {text}
  </div>
);
