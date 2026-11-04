"use client";

import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Chyba aplikace:", error);
  }, [error]);

  return (
    <main className="app-fallback-page">
      <section className="app-fallback-card">
        <span className="app-fallback-icon">⚠️</span>
        <span className="auth-eyebrow">DOLNÍ LHOTA V POHYBU</span>
        <h1>Něco se pokazilo</h1>
        <p>Aplikace narazila na neočekávanou chybu. Zkus stránku obnovit.</p>
        <div className="app-fallback-actions">
          <button type="button" className="run-primary-button" onClick={() => reset()}><RefreshCw size={18} /> Zkusit znovu</button>
          <Link className="run-secondary-button" href="/"><Home size={18} /> Domů</Link>
        </div>
      </section>
    </main>
  );
}
