"use client";
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function RunForm({ type }: { type: string }) {
  const [showForm, setShowForm] = useState(false);
  const [km, setKm] = useState("");
  const [minuty, setMinuty] = useState("");
  const [sekundy, setSekundy] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const uploadToCloudinary = async (file: File) => {
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

  const handleSubmit = async () => {
    const kmVal = parseFloat(km);
    const minVal = parseInt(minuty);
    const secVal = parseInt(sekundy);

    if (!km || !minuty || sekundy === "") {
      setError("Vyplňte prosím všechny údaje.");
      return;
    }

    if (kmVal <= 0 || minVal < 0 || secVal < 0 || secVal >= 60) {
      setError("Zadejte platné hodnoty. Sekundy 0–59, minuty 0+, km > 0.");
      return;
    }

    try {
      let imageUrls: string[] = [];

      if (files.length > 0) {
        for (let file of files) {
          const url = await uploadToCloudinary(file);
          imageUrls.push(url);
        }
      }

      let avatarUrl = "";
      let teamId = null;

      const uid = auth.currentUser?.uid;
      if (!uid) {
        console.warn("Uživatel není přihlášen");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        avatarUrl = userData.avatarUrl || "";
        teamId = userData.teamId || null;
      }

      const totalMinutes = minVal + secVal / 60;

      await addDoc(collection(db, "runs"), {
        uid: uid,
        email: auth.currentUser?.email,
        avatarUrl,
        km: kmVal,
        minuty: totalMinutes,
        tempo: (totalMinutes / kmVal).toFixed(2),
        type,
        timestamp: serverTimestamp(),
        imageUrls,
        teamId
      });

      setKm(""); setMinuty(""); setSekundy(""); setFiles([]);
      setError("");
      setSuccess(`${type[0].toUpperCase() + type.slice(1)} byl úspěšně uložen.`);
      setTimeout(() => setSuccess(""), 3000);
      setShowForm(false);

    } catch (err) {
      console.error(err);
      setError("Chyba při ukládání záznamu.");
    }
  };

  return (
    <div style={{ textAlign: "center", fontFamily: "'Poppins', sans-serif", marginTop: "0rem" }}>
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          ➕ Přidat nový záznam
        </button>
      )}

      {showForm && (
        <div style={{
          maxWidth: "400px",
          margin: "0 auto",
          width: "100%",
          padding: "0 1rem",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          <input
            type="number"
            min="0.1"
            placeholder="Kilometry"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            min="1"
            placeholder="Minuty"
            value={minuty}
            onChange={(e) => setMinuty(e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            min="0"
            max="59"
            placeholder="Sekundy"
            value={sekundy}
            onChange={(e) => setSekundy(e.target.value)}
            style={inputStyle}
          />

          <label style={{
            ...inputStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            cursor: "pointer",
            marginTop: "10px"
          }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={{ display: "none" }}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#333" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M23 19V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span style={{ fontSize: "1rem", color: "#333" }}>
              {files.length > 0 ? `${files.length} souborů` : "Přidat soubory"}
            </span>
          </label>

          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginTop: "20px",
            width: "100%"
          }}>
            <button
              onClick={() => setShowForm(false)}
              style={{ ...buttonStyle, flex: 1 }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Zavřít
            </button>

            <button
              onClick={handleSubmit}
              style={{
                ...buttonStyle,
                background: "#eee",
                color: "#333",
                flex: 2
              }}
            >
              Uložit záznam
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      {success && <div style={{ color: "lightgreen", marginTop: "10px" }}>{success}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  margin: "10px 0",
  padding: "10px 16px",
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: "10px",
  fontSize: "1rem",
  color: "#333",
  backgroundColor: "white",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  outline: "none",
  transition: "all 0.3s",
  boxSizing: "border-box"
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 20px",
  background: "rgba(255,255,255,0.2)",
  color: "white",
  fontWeight: 600,
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "1rem",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  transition: "all 0.3s"
};
