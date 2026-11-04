"use client";

import "./globals.css";
import "./fixes.css";

import { RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="cs">
      <body>
        <main className="app-fallback-page">
          <section className="app-fallback-card">
            <span className="app-fallback-icon">⚠️</span>
            <span className="auth-eyebrow">DOLNÍ LHOTA V POHYBU</span>
            <h1>Aplikaci se nepodařilo načíst</h1>
            <p>Zkus ji obnovit. Pokud problém přetrvá, může jít o dočasný výpadek služby.</p>
            <button type="button" className="run-primary-button" onClick={() => reset()}><RefreshCw size={18} /> Obnovit aplikaci</button>
          </section>
        </main>
      </body>
    </html>
  );
}
