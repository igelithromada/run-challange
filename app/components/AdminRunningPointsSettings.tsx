"use client";

import { useState, type FormEvent } from "react";
import { auth } from "../lib/firebase";
import { MAX_DAILY_BONUS, parseRunningPointsConfig, RUN_POINT_FIELDS, type RunningPointsConfig } from "../lib/runningPointsConfig";
import { applyRunningPointsRules, refreshRunningPointsRules, useRunningPointsRules } from "../lib/useRunningPointsRules";
import RunningPointsRules from "./RunningPointsRules";

function SettingsForm({ rules }: { rules: RunningPointsConfig }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || saving) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(RUN_POINT_FIELDS.map(({ key }) => [key, Number(form.get(key))]));
    const weeklyBonuses = rules.weeklyBonuses.map((_, index) => index === 0 ? 0 : Number(form.get(`day-${index}`)));
    const edited = parseRunningPointsConfig({ ...values, weeklyBonuses });
    if (!edited) {
      setFailed(true);
      setMessage("Zkontroluj hodnoty v nastavení.");
      return;
    }

    setSaving(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch("/api/running-points", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bodování se nepodařilo uložit.");
      const saved = parseRunningPointsConfig(data.rules);
      if (!saved) throw new Error("Uložená pravidla se nepodařilo načíst.");
      if (auth.currentUser?.uid === user.uid) applyRunningPointsRules(saved);
      setMessage("Bodování bylo uloženo.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Bodování se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="running-points-admin-form" onSubmit={save}>
    <p>Změny přepočítají body i úrovně ze všech dosavadních běhů.</p>
    <fieldset disabled={saving}>
      <legend>Výpočet bodů a úrovní</legend>
      <div className="running-points-admin-grid">
        {RUN_POINT_FIELDS.map(({ key, label, min, max, step }) =>
          <label key={key} className="settings-field">{label}
            <input className="settings-input" type="number" name={key} required min={min} max={max} step={step} defaultValue={rules[key]}/>
          </label>)}
      </div>
    </fieldset>
    <fieldset disabled={saving}>
      <legend>Plný bonus podle pořadí běžeckého dne</legend>
      <p>První den je vždy bez bonusu. Nulou můžeš vypnout bonus i pro další den.</p>
      <div className="running-points-admin-grid">
        {rules.weeklyBonuses.slice(1).map((bonus, index) =>
          <label key={index} className="settings-field">{index + 2}. den
            <input className="settings-input" type="number" name={`day-${index + 1}`} required min={0} max={MAX_DAILY_BONUS} step={1} defaultValue={bonus}/>
          </label>)}
      </div>
    </fieldset>
    <button type="submit" className="run-primary-button" disabled={saving}>{saving ? "Ukládám…" : "Uložit bodování"}</button>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </form>;
}

export default function AdminRunningPointsSettings() {
  const { rules, error } = useRunningPointsRules();
  return <details className="tile running-points-rules running-points-rules-admin">
    <summary>Bodování běhu</summary>
    {rules ? <>
      <SettingsForm rules={rules}/>
      <RunningPointsRules rules={rules} detailed/>
    </> : error ? <>
      <p role="alert">Nastavení bodování se nepodařilo načíst.</p>
      <button type="button" className="run-secondary-button" onClick={() => void refreshRunningPointsRules(true)}>Zkusit znovu</button>
    </> : <p role="status">Načítám nastavení bodování…</p>}
  </details>;
}
