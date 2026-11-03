"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth, storage } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader, { applyTheme } from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";

export default function SettingsPage() {
  useThemeLoader();

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
          applyTheme(data.theme || "default", data.customColor || "#36D1DC");
        } else {
          const initialData = {
            id: user.uid,
            email: user.email || "",
            nickname: "",
            avatarUrl: "",
            theme: "default",
            customColor: "#36D1DC"
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
      ...newData
    }, { merge: true });
  };

  const handleThemeChange = (selectedTheme: string) => {
    setTheme(selectedTheme);
    applyTheme(selectedTheme, customColor);
    saveSettings({ theme: selectedTheme });
  };

  const handleCustomColorLiveChange = (color: string) => {
    setCustomColor(color);
    setTheme("custom");
    applyTheme("custom", color);
  };

  const handleCustomColorFinalSave = () => {
    saveSettings({ theme: "custom", customColor });
    setShowColorPicker(false);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
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
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const avatarRef = ref(storage, `avatars/${userId}/${Date.now()}-${safeFileName}`);
      await uploadBytes(avatarRef, file);
      const downloadUrl = await getDownloadURL(avatarRef);
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
    } else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "settings") router.push("/settings");
    else if (item === "statistics") router.push("/statistics");
  };

  return (
    <>
      <Navbar onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <div className="container">
        <h1 className="centered-title">Nastavení</h1>

        <div className="tile">
          <h3>Uživatelské jméno</h3>
          <input
            type="text"
            value={nickname}
            placeholder="Uživatelské jméno"
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => saveSettings()}
            style={{
              width: "100%", padding: "0.5rem", borderRadius: "10px",
              border: "none", marginTop: "0.2rem"
            }}
          />
        </div>

        <div className="tile" style={{ textAlign: "center" }}>
          <h3>Změnit avatar</h3>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{
              width: "80px", height: "80px", borderRadius: "50%", marginBottom: "0.0rem"
            }} />
          ) : (
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%",
              background: "rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "5rem", marginBottom: "0.5rem"
            }}>
              {(nickname || email)?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            disabled={avatarUploading}
          />
          {avatarUploading && <p>Nahrávám avatar…</p>}
        </div>

        <div className="tile">
          <h3>Nastavení vzhledu</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "default"} onClick={() => handleThemeChange("default")} text="Výchozí vzhled" />
            <ThemeItem color="linear-gradient(180deg, #2980b9, #2c3e50)" active={theme === "man"} onClick={() => handleThemeChange("man")} text="Muž" />
            <ThemeItem color="linear-gradient(180deg, #ff7eb3, #ff758c)" active={theme === "woman"} onClick={() => handleThemeChange("woman")} text="Žena" />
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "auto"} onClick={() => handleThemeChange("auto")} text="Automaticky podle času" />
            <ThemeItem color="linear-gradient(160deg, #263849, #6bc6dc, #f5b94c)" active={theme === "weather"} onClick={() => handleThemeChange("weather")} text="Podle aktuálního počasí" />

            <div style={{
              marginTop: "0.7rem",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "0.5rem"
            }}>
              <div onClick={() => { setShowColorPicker(!showColorPicker); setTheme("custom"); }} style={{
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
