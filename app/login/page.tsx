"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [potvrzeniHesla, setPotvrzeniHesla] = useState("");
  const [kod, setKod] = useState("");
  const [error, setError] = useState("");
  const [zobrazeni, setZobrazeni] = useState<"login" | "code" | "register">("login");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, heslo);
      router.push("/");
    } catch {
      setError("Chyba při přihlášení: Špatný email nebo heslo.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Zadejte email pro obnovení hesla.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Na váš email byl odeslán odkaz pro obnovení hesla.");
    } catch {
      setError("Chyba při odesílání emailu.");
    }
  };

  const handleZkontrolovatKod = () => {
    if (kod === "Lhota2025") {
      setZobrazeni("register");
      setError("");
    } else {
      setError("Neplatný registrační kód.");
    }
  };

  const handleRegister = async () => {
    if (heslo !== potvrzeniHesla) {
      setError("Hesla se neshodují.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, heslo);
      router.push("/");
    } catch {
      setError("Chyba při registraci: Email už existuje nebo je neplatný.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--main-gradient, linear-gradient(180deg, #36D1DC, #5B86E5))",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      color: "white",
      fontFamily: "'Poppins', sans-serif"
    }}>
      <div className="tile" style={{ maxWidth: "400px", width: "90%", textAlign: "center" }}>
        <h2>
          {zobrazeni === "login" && "Přihlášení"}
          {zobrazeni === "code" && "Registrační kód"}
          {zobrazeni === "register" && "Registrace"}
        </h2>

        {zobrazeni === "login" && (
          <>
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle} /><br/>
            <input type="password" placeholder="Heslo" value={heslo}
              onChange={(e) => setHeslo(e.target.value)}
              style={inputStyle} /><br/>
            <button onClick={handleLogin} style={buttonStyle}>Přihlásit</button>
            <button onClick={handleForgotPassword} style={buttonStyle}>Zapomněl jsem heslo</button>
            <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
              Nemáte účet?{" "}
              <span onClick={() => setZobrazeni("code")} style={{ cursor: "pointer", textDecoration: "underline" }}>
                Registrovat
              </span>
            </div>
          </>
        )}

        {zobrazeni === "code" && (
          <>
            <input type="text" placeholder="Registrační kód" value={kod}
              onChange={(e) => setKod(e.target.value)}
              style={inputStyle} /><br/>
            <button onClick={handleZkontrolovatKod} style={buttonStyle}>Potvrdit</button>
            <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
              <span onClick={() => setZobrazeni("login")} style={{ cursor: "pointer", textDecoration: "underline" }}>
                Zpět na přihlášení
              </span>
            </div>
          </>
        )}

        {zobrazeni === "register" && (
          <>
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle} /><br/>
            <input type="password" placeholder="Heslo" value={heslo}
              onChange={(e) => setHeslo(e.target.value)}
              style={inputStyle} /><br/>
            <input type="password" placeholder="Potvrzení hesla" value={potvrzeniHesla}
              onChange={(e) => setPotvrzeniHesla(e.target.value)}
              style={inputStyle} /><br/>
            <button onClick={handleRegister} style={buttonStyle}>Registrovat</button>
            <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
              <span onClick={() => setZobrazeni("login")} style={{ cursor: "pointer", textDecoration: "underline" }}>
                Zpět na přihlášení
              </span>
            </div>
          </>
        )}

        {error && <div style={{ color: "#ffcccc", marginTop: "1rem" }}>{error}</div>}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "0.5rem",
  borderRadius: "8px",
  border: "none",
  outline: "none",
  margin: "0.5rem 0",
  width: "100%"
};

const buttonStyle = {
  width: "100%",
  padding: "0.6rem",
  margin: "0.5rem 0",
  background: "rgba(255,255,255,0.3)",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "0.3s"
};