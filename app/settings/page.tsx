"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/app/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import CustomColorPicker from "../components/CustomColorPicker";

export default function SettingsPage() {
  const [nickname, setNickname] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadUserSettings = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNickname(data.nickname || "");
          setSelectedTheme(data.theme || "default");
          setCustomColor(data.customColor || null);
        }
      }
    };

    loadUserSettings();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    await setDoc(
      userDocRef,
      {
        nickname,
        theme: selectedTheme,
        customColor,
      },
      { merge: true }
    );

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
    if (theme !== "custom") {
      setCustomColor(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-6">Nastavení</h1>

      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-4">
        <label className="block mb-2 font-bold">Uživatelské jméno</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full p-2 mb-4 rounded-md border border-gray-300"
        />

        <label className="block mb-2 font-bold">Změnit avatar</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setAvatarFile(e.target.files ? e.target.files[0] : null)
          }
          className="mb-4"
        />

        <div className="mb-2 font-bold">Nastavení vzhledu</div>
        <div className="flex flex-col gap-2 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="default"
              checked={selectedTheme === "default"}
              onChange={() => handleThemeChange("default")}
            />
            Výchozí vzhled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="man"
              checked={selectedTheme === "man"}
              onChange={() => handleThemeChange("man")}
            />
            Muž
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="woman"
              checked={selectedTheme === "woman"}
              onChange={() => handleThemeChange("woman")}
            />
            Žena
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="auto"
              checked={selectedTheme === "auto"}
              onChange={() => handleThemeChange("auto")}
            />
            Automaticky podle času
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="custom"
              checked={selectedTheme === "custom"}
              onChange={() => handleThemeChange("custom")}
            />
            Vlastní barva
          </label>
        </div>

        {selectedTheme === "custom" && (
          <div className="mb-4">
            <CustomColorPicker
              onColorChange={(color) => setCustomColor(color)}
            />
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 rounded-md font-bold"
        >
          Uložit nastavení
        </button>

        {saved && (
          <div className="text-green-600 mt-2 text-center">
            Nastavení uloženo
          </div>
        )}
      </div>
    </div>
  );
}
