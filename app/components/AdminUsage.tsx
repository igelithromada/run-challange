"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { auth } from "../lib/firebase";
import { FIRESTORE_LIMITS, type ServiceUsage } from "../lib/serviceUsage";

const format = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });
const firebase = "https://console.firebase.google.com/project/dolni-lhota-run";

function Meter({ title, used, limit }: { title: string; used: number | null; limit: number }) {
  if (used === null) return <p>{title} · údaj není dostupný</p>;
  const fraction = used / limit;
  return <div className="admin-usage-meter">
    <div><strong>{title}</strong><span>{format.format(used)} / {format.format(limit)} · {format.format(fraction * 100)} %</span></div>
    <progress aria-label={title} value={Math.min(used, limit)} max={limit} />
    {fraction >= .9 ? <small>Kritická hranice</small> : fraction >= .7 ? <small>Blízko limitu</small> : null}
  </div>;
}

export default function AdminUsage() {
  const [data, setData] = useState<ServiceUsage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function fetchUsage() {
    const user = auth.currentUser;
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/usage", {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error("Usage unavailable");
      const next: ServiceUsage = await response.json();
      if (auth.currentUser?.uid === user.uid) setData(next);
    } catch {
      if (auth.currentUser?.uid === user.uid) setError("Spotřebu se nepodařilo načíst.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="tile admin-usage" onToggle={event => {
    if (event.currentTarget.open && !data && !error) void fetchUsage();
  }}>
    <summary><Gauge size={20} aria-hidden="true" /> Spotřeba služeb</summary>
    <div className="admin-usage-body" aria-busy={busy}>
      <div className="admin-usage-actions">
        {data && <small>Načteno {new Date(data.checkedAt).toLocaleString("cs-CZ")}</small>}
        <button type="button" className="run-secondary-button" disabled={busy} onClick={() => void fetchUsage()}>{busy ? "Načítám…" : "Obnovit údaje"}</button>
      </div>
      {error && <p role="status">{error}</p>}
      <section>
        <h3>Firestore</h3>
        {data?.firestore ? <>
          <small>Od {new Date(data.firestore.since).toLocaleString("cs-CZ")} · Metriky se mohou zpozdit a lišit od účtované spotřeby.</small>
          <Meter title="Čtení" used={data.firestore.reads} limit={FIRESTORE_LIMITS.reads} />
          <Meter title="Zápisy" used={data.firestore.writes} limit={FIRESTORE_LIMITS.writes} />
          <Meter title="Smazání" used={data.firestore.deletes} limit={FIRESTORE_LIMITS.deletes} />
        </> : data && <p>Údaje se nepodařilo načíst. Ověř přístup ke Cloud Monitoringu.</p>}
        <a href={firebase + "/firestore/usage"} target="_blank" rel="noreferrer">Otevřít spotřebu ve Firebase</a>
      </section>
      <section>
        <h3>Cloudinary</h3>
        {data?.cloudinary ? <>
          <Meter title="Kredity" used={data.cloudinary.credits} limit={data.cloudinary.limit} />
          {data.cloudinary.storage !== null && <p>Úložiště {format.format(data.cloudinary.storage / 1e9)} GB</p>}
          {data.cloudinary.bandwidth !== null && <p>Přenos {format.format(data.cloudinary.bandwidth / 1e9)} GB</p>}
        </> : data && <p>Údaje se nepodařilo načíst. Celkovou spotřebu najdeš v účtu.</p>}
        <a href="https://console.cloudinary.com/" target="_blank" rel="noreferrer">Otevřít Cloudinary</a>
      </section>
      <section>
        <h3>Vercel a přihlášení</h3>
        <p><a href="https://vercel.com/radeks-projects-ddd77e55/~/usage" target="_blank" rel="noreferrer">Spotřeba Vercelu</a></p>
        <p><a href={firebase + "/authentication/users"} target="_blank" rel="noreferrer">Firebase Authentication</a></p>
      </section>
    </div>
  </details>;
}
