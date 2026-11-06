"use client";

import React, { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

type View = "login" | "reset" | "code" | "register";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [potvrzeniHesla, setPotvrzeniHesla] = useState("");
  const [kod, setKod] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const switchView = (next: View) => {
    setError("");
    setMessage("");
    setView(next);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), heslo);
      router.push("/");
    } catch {
      setError("Špatný email nebo heslo.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) { setError("Zadej email, na který chceš poslat odkaz."); return; }
    setBusy(true);
    try {
      auth.languageCode = "cs";
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Pokud účet s tímto emailem existuje, Firebase poslal odkaz pro obnovení hesla. Zkontroluj i Spam.");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code || "") : "";
      setError(code.includes("invalid-email") ? "Email nemá platný formát." : "Odkaz pro obnovení se nepodařilo odeslat. Zkus to znovu.");
    } finally { setBusy(false); }
  };

  const handleCheckCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/registration-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: kod.trim() }),
      });
      if (response.ok) {
        setView("register");
      } else if (response.status === 503) {
        setError("Registrace zatím není na serveru nastavena. Kontaktuj správce.");
      } else if (response.status === 403 || response.status === 400) {
        setError("Neplatný registrační kód.");
      } else {
        setError("Kód se nepodařilo ověřit. Zkus to prosím znovu.");
      }
    } catch {
      setError("Kód se nepodařilo ověřit. Zkontroluj připojení k internetu.");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (heslo.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    if (heslo !== potvrzeniHesla) {
      setError("Hesla se neshodují.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: heslo, code: kod.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Registrace se nepodařila.");
      if (!result.customToken) throw new Error("Registrace se nepodařila dokončit.");
      await signInWithCustomToken(auth, result.customToken);
      router.push("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registrace se nepodařila. Zkus to prosím znovu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">👟</span>
          <div>
            <span className="auth-eyebrow">DOLNÍ LHOTA</span>
            <strong>v pohybu</strong>
          </div>
        </div>

        <div className="auth-heading">
          <h1 id="auth-title">
            {view === "login" ? "Vítej zpět" : view === "reset" ? "Obnovení hesla" : view === "code" ? "Registrace" : "Vytvořit účet"}
          </h1>
          <p>
            {view === "login"
              ? "Přihlas se a pokračuj ve svém progresu."
              : view === "reset"
                ? "Zadej email a pošleme ti odkaz pro nastavení nového hesla."
              : view === "code"
                ? "Pro registraci potřebuješ platný registrační kód."
                : "Nastav si účet a začni zaznamenávat své aktivity."}
          </p>
        </div>

        {view === "login" && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label><span>Heslo</span><input type="password" autoComplete="current-password" value={heslo} onChange={e => setHeslo(e.target.value)} required /></label>
            <button type="submit" className="auth-primary" disabled={busy}><LogIn size={18} /> {busy ? "Přihlašuji…" : "Přihlásit"}</button>
            <button type="button" className="auth-secondary" onClick={() => switchView("reset")} disabled={busy}>Zapomněl jsem heslo</button>
            <button type="button" className="auth-link-button" onClick={() => switchView("code")}>Nemáš účet? <strong>Registrovat</strong></button>
          </form>
        )}

        {view === "reset" && (
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <button type="submit" className="auth-primary" disabled={busy}><KeyRound size={18} /> {busy ? "Odesílám…" : "Poslat odkaz pro obnovení"}</button>
            <button type="button" className="auth-link-button" onClick={() => switchView("login")}><ArrowLeft size={16} /> Zpět na přihlášení</button>
          </form>
        )}

        {view === "code" && (
          <form className="auth-form" onSubmit={handleCheckCode}>
            <label><span>Registrační kód</span><input type="text" autoComplete="one-time-code" value={kod} onChange={e => setKod(e.target.value)} required /></label>
            <button type="submit" className="auth-primary" disabled={busy}><KeyRound size={18} /> {busy ? "Ověřuji…" : "Ověřit kód"}</button>
            <button type="button" className="auth-link-button" onClick={() => switchView("login")}><ArrowLeft size={16} /> Zpět na přihlášení</button>
          </form>
        )}

        {view === "register" && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label><span>Heslo</span><input type="password" autoComplete="new-password" minLength={6} value={heslo} onChange={e => setHeslo(e.target.value)} required /></label>
            <label><span>Potvrzení hesla</span><input type="password" autoComplete="new-password" minLength={6} value={potvrzeniHesla} onChange={e => setPotvrzeniHesla(e.target.value)} required /></label>
            <button type="submit" className="auth-primary" disabled={busy}><UserPlus size={18} /> {busy ? "Vytvářím účet…" : "Vytvořit účet"}</button>
            <button type="button" className="auth-link-button" onClick={() => switchView("login")}><ArrowLeft size={16} /> Zpět na přihlášení</button>
          </form>
        )}

        {error && <p className="form-message form-message-error" role="alert">{error}</p>}
        {message && <p className="form-message form-message-success" role="status">{message}</p>}
      </section>
    </main>
  );
}
