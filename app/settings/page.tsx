"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "../lib/firebase";

export default function SettingsPage() {
  const [userId, setUserId] = useState(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [file, setFile] = useState(null);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const presetAvatars = [
    "/avatars/muz.png",
    "/avatars/zena.png",
    "/avatars/dite.png",
    "/avatars/cerveny.png",
    "/avatars/modry.png",
    "/avatars/zluty.png"
  ];

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserId(user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNickname(data.nickname || "");
          setAvatarUrl(data.avatarUrl || "");
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "lhota_unsigned");

    const res = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Chyba při nahrávání na Cloudinary");
    const data = await res.json();
    return data.secure_url;
  };

  const handleSave = async () => {
    try {
      let finalAvatarUrl = avatarUrl;

      if (file) {
        finalAvatarUrl = await uploadToCloudinary(file);
      }

      await setDoc(doc(db, "users", userId), {
        nickname,
        avatarUrl: finalAvatarUrl
      }, { merge: true });

      setSuccess("Nastavení bylo uloženo.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Chyba při ukládání.");
    }
  };

  if (loading) return <div style={{ textAlign: "center", marginTop: "2rem" }}>Načítám...</div>;

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Nastavení uživatele</h1>

      <div style={{ marginTop: "1rem" }}>
        <input 
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Uživatelské jméno"
          style={{ padding: "8px", width: "300px", marginRight: "10px" }}
        />
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Avatar</div>
        {avatarUrl && (
          <div>
            <img src={avatarUrl} alt="avatar" style={{ width: "100px", borderRadius: "50%", marginBottom: "0.5rem" }} />
          </div>
        )}
        <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: "1rem" }} />
        <div style={{ margin: "1rem 0" }}>
          <div style={{ marginBottom: "0.5rem" }}>Nebo si vyber předvolený avatar:</div>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
            {presetAvatars.map(url => (
              <img 
                key={url}
                src={url}
                alt="preset avatar"
                onClick={() => { setAvatarUrl(url); setFile(null); }}
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  border: avatarUrl === url ? "3px solid orange" : "2px solid #ccc",
                  cursor: "pointer"
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        style={{ marginTop: "1rem", padding: "10px 20px", backgroundColor: "green", color: "white", border: "none", borderRadius: "5px" }}
      >
        Uložit
      </button>

      {success && <div style={{ color: "green", marginTop: "1rem" }}>{success}</div>}
    </div>
  );
}