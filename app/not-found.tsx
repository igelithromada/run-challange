import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="app-fallback-page">
      <section className="app-fallback-card">
        <span className="app-fallback-icon">👟</span>
        <span className="auth-eyebrow">404</span>
        <h1>Stránka neexistuje</h1>
        <p>Adresa, kterou hledáš, není součástí aplikace.</p>
        <Link className="run-primary-button" href="/"><Home size={18} /> Zpět domů</Link>
      </section>
    </main>
  );
}
