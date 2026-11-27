"use client";

import { useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import type { ActivityPoints } from "../lib/activityPoints";
import ActivityPointSummary, { formatPoints, LevelShield } from "./ActivityPointSummary";
import RunningPointsRules from "./RunningPointsRules";
import OverlayDialog from "./OverlayDialog";

export default function ActivityLevelButton({ score, nickname, recordId }: {
  score: ActivityPoints; nickname: string; recordId?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const record = recordId ? score.records.get(recordId) ?? null : undefined;
  if (record === null) return null;
  const gained = record ? record.distancePoints + record.consistencyPoints : 0;
  const amount = (gained > 0 ? "+" : "") + formatPoints(gained);
  const dismiss = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  return <>
    {record ? <button ref={button} type="button" className="activity-run-points" aria-haspopup="dialog"
      aria-label={`Body za běh, ${amount}`} onClick={() => setOpen(true)}>
      <strong>{amount}</strong><ChevronRight size={13} aria-hidden="true"/>
    </button> : <button ref={button} type="button" className="activity-awards-button activity-level-button" aria-haspopup="dialog"
      aria-label={`Úroveň ${score.level} uživatele ${nickname}`} title={`Úroveň ${score.level} · ${score.rank.name}`}
      onClick={() => setOpen(true)}>
      <LevelShield level={score.level} tone={score.rank.tone}/>
    </button>}
    {open && <OverlayDialog label={`${record ? "Body za běh" : "Body a úroveň"} · ${nickname}`} className="activity-awards-dialog activity-level-dialog" onDismiss={dismiss}>
      <section>
        <header><div><h2>{recordId ? "Body za běh" : "Body a úroveň"}</h2><small>{nickname}</small></div>
          <button type="button" className="ui-icon-button" aria-label="Zavřít přehled" onClick={dismiss}><X size={18}/></button>
        </header>
        <ActivityPointSummary score={score} record={record}/>
        <RunningPointsRules rules={score.rules}/>
      </section>
    </OverlayDialog>}
  </>;
}
