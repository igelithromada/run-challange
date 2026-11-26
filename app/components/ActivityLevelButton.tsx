"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { activityPoints, type ActivityPoints } from "../lib/activityPoints";
import { personalHistoryQuery } from "../lib/services/runs";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import type { RunData } from "../types";
import ActivityPointSummary, { LevelShield } from "./ActivityPointSummary";
import { useScoringDay } from "../lib/useScoringDay";
import RunningPointsRules from "./RunningPointsRules";
import OverlayDialog from "./OverlayDialog";

const summaryCache = new WeakMap<RunData[], { day: number; score: ActivityPoints }>();

function LevelButton({ score, nickname, recordId }: {
  score: ActivityPoints; nickname: string; recordId?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const record = recordId ? score.records.get(recordId) ?? null : undefined;
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
        <header><div><h2>{recordId ? "Body za běh" : "Body a úroveň"}</h2><small>{nickname}</small></div>
          <button type="button" className="ui-icon-button" aria-label="Zavřít přehled" onClick={dismiss}><X size={18}/></button>
        </header>
        <ActivityPointSummary score={score} record={record}/>
        <RunningPointsRules/>
      </section>
    </OverlayDialog>}
  </>;
}

function LiveLevelButton({ uid, nickname, recordId }: { uid: string; nickname: string; recordId?: string }) {
  const query = useMemo(() => personalHistoryQuery(uid), [uid]);
  const { data, loading, error } = useSharedFirestoreQuery<RunData>("personal-history:v2:" + uid, query);
  const day = useScoringDay();
  if (loading || (error && !data.length)) return null;
  let cached = summaryCache.get(data);
  if (cached?.day !== day) {
    cached = { day, score: activityPoints(data) };
    summaryCache.set(data, cached);
  }
  return <LevelButton score={cached.score} nickname={nickname} recordId={recordId}/>;
}

export default function ActivityLevelButton({ uid, nickname, score, recordId }: {
  uid: string; nickname: string; score?: ActivityPoints; recordId?: string;
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
    {score ? <LevelButton score={score} nickname={nickname} recordId={recordId}/> : nearViewport && <LiveLevelButton uid={uid} nickname={nickname} recordId={recordId}/>}
  </span>;
}
