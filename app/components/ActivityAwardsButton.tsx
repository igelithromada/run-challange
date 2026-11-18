"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Award as AwardIcon, X } from "lucide-react";
import { ACTIVITY_TYPES } from "../lib/activity";
import { activityAwards, type Award } from "../lib/awards";
import { auth } from "../lib/firebase";
import { fetchRuns, personalHistoryQuery } from "../lib/services/runs";

const recent = new Map<string, { expires: number; result: Promise<Award[]> }>();

function loadAwards(uid: string) {
  const key = `${auth.currentUser?.uid}:${uid}`;
  const cached = recent.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  const result = fetchRuns(personalHistoryQuery(uid)).then(runs => {
    const earned = new Map<string, Award>();
    for (const type of ACTIVITY_TYPES) {
      for (const badge of activityAwards(runs, type)) {
        if (!badge.repeatable || !badge.count) continue;
        const id = badge.id + ':' + badge.title;
        const previous = earned.get(id);
        earned.set(id, { ...badge, id, count: (previous?.count ?? 0) + badge.count });
      }
    }
    return [...earned.values()];
  });
  const entry = { expires: Date.now() + 30_000, result };
  if (recent.size >= 50) recent.delete(recent.keys().next().value!);
  recent.set(key, entry);
  void result.catch(() => { if (recent.get(key) === entry) recent.delete(key); });
  return result;
}

function AwardsDialog({ uid, nickname, onClose }: { uid: string; nickname: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);

  useEffect(() => {
    let active = true;
    const viewer = auth.currentUser?.uid;
    loadAwards(uid).then(value => {
      if (active && auth.currentUser?.uid === viewer) setAwards(value);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [uid]);

  return <dialog ref={dialog} className="activity-awards-dialog" aria-labelledby={title}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <section>
      <header>
        <div><h2 id={title}>Odznaky</h2><small>{nickname}</small></div>
        <button type="button" className="ui-icon-button" aria-label="Zavřít odznaky" onClick={onClose}><X size={18}/></button>
      </header>
      {error ? <p role="alert">Odznaky se nepodařilo načíst.</p> : !awards ? <p role="status">Načítám odznaky…</p>
        : awards.length ? <ul className="activity-awards-grid">
          {awards.map(badge => <li key={badge.id}>
            <span aria-hidden="true">{badge.icon}</span><div><strong>{badge.title}</strong><small>{badge.count}×</small></div>
          </li>)}
        </ul> : <p>Zatím žádné získané odznaky.</p>}
    </section>
  </dialog>;
}

export default function ActivityAwardsButton({ uid, nickname }: { uid: string; nickname: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={button} type="button" className="activity-awards-button" aria-haspopup="dialog"
      aria-label={`Odznaky uživatele ${nickname}`} title="Odznaky" onClick={() => setOpen(true)}>
      <AwardIcon size={17} aria-hidden="true" />
    </button>
    {open && <AwardsDialog uid={uid} nickname={nickname} onClose={() => {
      setOpen(false);
      requestAnimationFrame(() => button.current?.focus());
    }} />}
  </>;
}
