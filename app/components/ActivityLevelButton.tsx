"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { activityPoints, type ActivityPoints } from "../lib/activityPoints";
import { personalHistoryQuery } from "../lib/services/runs";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import type { RunData } from "../types";
import ActivityPointSummary, { LevelShield } from "./ActivityPointSummary";
import AwardMetrics from "./AwardMetrics";
import type { Award } from "../lib/awards";
import OverlayDialog from "./OverlayDialog";

const summaryCache = new WeakMap<RunData[], ActivityPoints>();

function earnedBadges(score: ActivityPoints) {
  const byId = new Map<string, Award>();
  for (const award of Object.values(score.awardsByType).flat()) {
    if (!award.repeatable || !award.count) continue;
    const previous = byId.get(award.id);
    const title = previous && previous.title !== award.title ? "Noční aktivita" : award.title;
    byId.set(award.id, { ...award, title, count: (previous?.count ?? 0) + award.count });
  }
  return [...byId.values()];
}

function LevelButton({ score, nickname }: { score: ActivityPoints; nickname: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const dismiss = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  return <>
    <button ref={button} type="button" className="activity-awards-button activity-level-button" aria-haspopup="dialog"
      aria-label={`Úroveň ${score.level} uživatele ${nickname}`} title={`Úroveň ${score.level} · ${score.rank.name}`}
      onClick={() => setOpen(true)}>
      <LevelShield level={score.level} tone={score.rank.tone}/>
    </button>
    {open && <OverlayDialog label={`Body a úroveň uživatele ${nickname}`} className="activity-awards-dialog activity-level-dialog" onDismiss={dismiss}>
      <section>
        <header><div><h2>Body a úroveň</h2><small>{nickname}</small></div>
          <button type="button" className="ui-icon-button" aria-label="Zavřít přehled" onClick={dismiss}><X size={18}/></button>
        </header>
        <ActivityPointSummary score={score}/>
        {score.badges > 0 && <details className="activity-level-badges">
          <summary>Získané odznaky</summary>
          <AwardMetrics awards={earnedBadges(score)} label="Získané odznaky"/>
        </details>}
      </section>
    </OverlayDialog>}
  </>;
}

function LiveLevelButton({ uid, nickname }: { uid: string; nickname: string }) {
  const query = useMemo(() => personalHistoryQuery(uid), [uid]);
  const { data, loading, error } = useSharedFirestoreQuery<RunData>("personal-history:v2:" + uid, query);
  if (loading || (error && !data.length)) return null;
  let score = summaryCache.get(data);
  if (!score) {
    score = activityPoints(data);
    summaryCache.set(data, score);
  }
  return <LevelButton score={score} nickname={nickname}/>;
}

export default function ActivityLevelButton({ uid, nickname, score }: {
  uid: string; nickname: string; score?: ActivityPoints;
}) {
  const [nearViewport, setNearViewport] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (score) return;
    if (typeof IntersectionObserver === "undefined" || !anchor.current) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      setNearViewport(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: "160px" });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [score]);

  return <span ref={anchor} className="activity-awards-anchor">
    {score ? <LevelButton score={score} nickname={nickname}/> : nearViewport && <LiveLevelButton uid={uid} nickname={nickname}/>}
  </span>;
}
