"use client";
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function RunForm({ type }) {
  const [km, setKm] = useState<string>("");
  const [minuty, setMinuty] = useState<string>("");
  const [file, setFile] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // upload fotky na Cloudinary
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

  // uložení záznamu
  const handleSubmit = async () => {
    if (!km || !minuty) {
      setError("Vyplňte prosím všechny údaje.");
      return;
    }

    try {
      let imageUrl = "";
      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }

      const joinedTeam = localStorage.getItem("joinedTeam");

      await addDoc(collection(db, "runs"), {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        km: parseFloat(km),
        minuty: parseFloat(minuty),
        tempo: (parseFloat(minuty) / parseFloat(km)).toFixed(2),
        type,
        timestamp: serverTimestamp(),
        imageUrl,
        teamId: joinedTeam || null
      });

      setKm(""); setMinuty(""); setFile(null);
      setError(""); 
      setSuccess(`${type[0].toUpperCase() + type.slice(1)} byl úspěšně uložen.`);
      setTimeout(() => setSuccess(""), 3000);

    } catch (err) {
      console.error(err);
      setError("Chyba při ukládání záznamu.");
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <input 
        type="number" 
        placeholder="Kilometry" 
        value={km} 
        onChange={(e) => setKm(e.target.value)}
        style={{ margin: "10px", padding: "8px", width: "60%" }} 
      />
      <input 
        type="number" 
        placeholder="Minuty" 
        value={minuty} 
        onChange={(e) => setMinuty(e.target.value)}
        style={{ margin: "10px", padding: "8px", width: "60%" }} 
      />
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files[0])}
        style={{ margin: "10px", padding: "8px", width: "60%" }} 
      />
      <button 
        onClick={handleSubmit}
        style={{ 
          marginTop: "10px", 
          padding: "10px 20px", 
          backgroundColor: "green", 
          color: "white", 
          borderRadius: "5px" 
        }}>
        Přidat
      </button>
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      {success && <div style={{ color: "green", marginTop: "10px" }}>{success}</div>}
    </div>
  );
}