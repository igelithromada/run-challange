"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
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
  const googleProvider = new GoogleAuthProvider();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, heslo);
      router.push("/");
    } catch (err) {
      setError("Chyba při přihlášení: Špatný email nebo heslo.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Chyba při přihlášení přes Google.");
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
    } catch (err) {
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
    } catch (err) {
      setError("Chyba při registraci: Email už existuje nebo je neplatný.");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "3rem" }}>
      <h2>
        {zobrazeni === "login" && "Přihlášení"}
        {zobrazeni === "code" && "Zadejte registrační kód"}
        {zobrazeni === "register" && "Registrace"}
      </h2>

      {zobrazeni === "login" && (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <input
            type="password"
            placeholder="Heslo"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <button onClick={handleLogin} style={{ margin: "0.5rem" }}>
            Přihlásit
          </button><br/>
          <button onClick={handleGoogleLogin} style={{ margin: "0.5rem", backgroundColor: "#4285F4", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px" }}>
            Přihlásit se přes Google
          </button><br/>
          <button onClick={handleForgotPassword} style={{ margin: "0.5rem" }}>
            Zapomněl jsem heslo
          </button>
          <div style={{ marginTop: "1rem" }}>
            Nemáte účet?{" "}
            <button onClick={() => setZobrazeni("code")}>
              Registrovat
            </button>
          </div>
        </>
      )}

      {zobrazeni === "code" && (
        <>
          <input
            type="text"
            placeholder="Registrační kód"
            value={kod}
            onChange={(e) => setKod(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <button onClick={handleZkontrolovatKod} style={{ margin: "0.5rem" }}>
            Potvrdit kód
          </button>
          <div style={{ marginTop: "1rem" }}>
            <button onClick={() => setZobrazeni("login")}>
              Zpět na přihlášení
            </button>
          </div>
        </>
      )}

      {zobrazeni === "register" && (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <input
            type="password"
            placeholder="Heslo"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <input
            type="password"
            placeholder="Potvrzení hesla"
            value={potvrzeniHesla}
            onChange={(e) => setPotvrzeniHesla(e.target.value)}
            style={{ margin: "0.5rem" }}
          /><br/>
          <button onClick={handleRegister} style={{ margin: "0.5rem" }}>
            Registrovat
          </button>
          <div style={{ marginTop: "1rem" }}>
            <button onClick={() => setZobrazeni("login")}>
              Zpět na přihlášení
            </button>
          </div>
        </>
      )}

      {error && (
        <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>
      )}
    </div>
  );
}