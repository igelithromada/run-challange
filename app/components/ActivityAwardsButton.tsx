"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Award as AwardIcon, X } from "lucide-react";
import { ACTIVITY_TYPES } from "../lib/activity";
import { activityAwards, awardTotal, type Award } from "../lib/awards";
import AwardMetrics from "./AwardMetrics";
import { personalHistoryQuery } from "../lib/services/runs";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import type { RunData } from "../types";

const badgeCache = new WeakMap<RunData[], Award[]>();

function earnedBadges(runs: RunData[]) {
  const cached = badgeCache.get(runs);
  if (cached) return cached;
  const earned = new Map<string, Award>();
  for (const type of ACTIVITY_TYPES) {
    for (const badge of activityAwards(runs, type)) {
      if (!badge.repeatable || !badge.count) continue;
      const previous = earned.get(badge.id);
      const title = badge.id === "night" && previous && previous.title !== badge.title ? "Noční aktivita" : badge.title;
      earned.set(badge.id, { ...badge, title, count: (previous?.count ?? 0) + badge.count });
    }
  }
  const badges = [...earned.values()];
  badgeCache.set(runs, badges);
  return badges;
}

function AwardsDialog({ awards, nickname, onClose }: { awards: Award[]; nickname: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);

  return <dialog ref={dialog} className="activity-awards-dialog" aria-labelledby={title}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <section>
      <header>
        <div><h2 id={title}>Odznaky</h2><small>{nickname}</small></div>
        <button type="button" className="ui-icon-button" aria-label="Zavřít odznaky" onClick={onClose}><X size={18}/></button>
      </header>
      <AwardMetrics awards={awards} label="Získané odznaky" />
    </section>
  </dialog>;
}

function LiveAwardsButton({ uid, nickname }: { uid: string; nickname: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const query = useMemo(() => personalHistoryQuery(uid), [uid]);
  const { data } = useSharedFirestoreQuery<RunData>("personal-history:v2:" + uid, query);
  const awards = earnedBadges(data);
  const count = awardTotal(awards);
  if (!count) return null;

  return <>
    <button ref={button} type="button" className="activity-awards-button" aria-haspopup="dialog"
      aria-label={`Odznaky uživatele ${nickname}, celkem ${count}`} title="Odznaky" onClick={() => setOpen(true)}>
      <AwardIcon size={17} aria-hidden="true" /><b>{count.toLocaleString("cs-CZ")}</b>
    </button>
    {open && <AwardsDialog awards={awards} nickname={nickname} onClose={() => {
      setOpen(false);
      requestAnimationFrame(() => button.current?.focus());
    }} />}
  </>;
}

export default function ActivityAwardsButton({ uid, nickname }: { uid: string; nickname: string }) {
  const [nearViewport, setNearViewport] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !anchor.current) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      setNearViewport(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: "160px" });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);

  return <span ref={anchor} className="activity-awards-anchor">
    {nearViewport && <LiveAwardsButton uid={uid} nickname={nickname}/>}
  </span>;
}
