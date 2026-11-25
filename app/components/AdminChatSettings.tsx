"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { auth } from "../lib/firebase";
import { useChatAvailability } from "../lib/chatLive";
import { showAppToast } from "./AppToast";

export default function AdminChatSettings() {
  const enabled = useChatAvailability();
  const [saving, setSaving] = useState(false);

  async function save(next: boolean) {
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/chat", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showAppToast(next ? "Chat je zapnutý pro všechny." : "Chat je vypnutý pro všechny.");
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : "Nastavení chatu se nepodařilo uložit.", "error");
    } finally {
      setSaving(false);
    }
  }

  return <section className="tile settings-notification-section">
    <label className="settings-notification-row">
      <span className="settings-notification-copy">
        <span className="settings-notification-title"><MessageCircle size={19}/> Společný chat</span>
        <small>{enabled === null ? "Zjišťuji stav chatu…" : "Zobrazit chat všem uživatelům aplikace."}</small>
      </span>
      <input type="checkbox" role="switch" checked={enabled === true} disabled={saving || enabled === null}
        onChange={event => void save(event.target.checked)}/>
    </label>
  </section>;
}
