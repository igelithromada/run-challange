"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import useThemeLoader from "../lib/useThemeLoader";
import { useRouter } from "next/navigation";
import { HexColorPicker } from "react-colorful";

export default function SettingsPage() {
  useThemeLoader();

  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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

  const applyTheme = (selectedTheme: string, color: string) => {
    let gradient = "";
    if (selectedTheme === "default") gradient = "linear-gradient(180deg, #36D1DC, #5B86E5)";
    else if (selectedTheme === "man") gradient = "linear-gradient(180deg, #2980b9, #2c3e50)";
    else if (selectedTheme === "woman") gradient = "linear-gradient(180deg, #ff7eb3, #ff758c)";
    else if (selectedTheme === "auto") {
      const hour = new Date().getHours();
      gradient = hour >= 6 && hour < 18
        ? "linear-gradient(180deg, #36D1DC, #5B86E5)"
        : "linear-gradient(180deg, #0f2027, #203a43, #2c5364)";
    }
    else if (selectedTheme === "custom") gradient = `linear-gradient(180deg, ${color}, #000000)`;
    document.documentElement.style.setProperty("--main-gradient", gradient);
  };

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
        saveSettings({ avatarUrl: reader.result });
      };
      reader.readAsDataURL(file);
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
          <input type="file" onChange={handleAvatarChange} />
        </div>

        <div className="tile">
          <h3>Nastavení vzhledu</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "default"} onClick={() => handleThemeChange("default")} text="Výchozí vzhled" />
            <ThemeItem color="linear-gradient(180deg, #2980b9, #2c3e50)" active={theme === "man"} onClick={() => handleThemeChange("man")} text="Muž" />
            <ThemeItem color="linear-gradient(180deg, #ff7eb3, #ff758c)" active={theme === "woman"} onClick={() => handleThemeChange("woman")} text="Žena" />
            <ThemeItem color="linear-gradient(180deg, #36D1DC, #5B86E5)" active={theme === "auto"} onClick={() => handleThemeChange("auto")} text="Automaticky podle času" />

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
