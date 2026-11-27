"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { activityPoints, type ActivityPoints } from "../lib/activityPoints";
import { personalHistoryQuery } from "../lib/services/runs";
import { useRunningPointsRules } from "../lib/useRunningPointsRules";
import { useScoringDay } from "../lib/useScoringDay";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import type { RunData } from "../types";
import ActivityLevelButton from "./ActivityLevelButton";
import { ActivityCardHeading } from "./ActivityCardContent";
import { LevelShield } from "./ActivityPointSummary";

const summaryCache = new WeakMap<RunData[], { day: number; score: ActivityPoints }>();

type Props = Omit<ComponentProps<typeof ActivityCardHeading>, "badge" | "points" | "headingRef"> & {
  uid: string;
  recordId: string;
  score?: ActivityPoints;
};

export default function ActivityRunHeading({ uid, recordId, score, ...heading }: Props) {
  const headingRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const target = headingRef.current;
    if (score || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      setNearViewport(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: "160px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [score]);

  const query = useMemo(() => personalHistoryQuery(uid), [uid]);
  const shouldListen = !score && (nearViewport || typeof IntersectionObserver === "undefined");
  const { data, loading, error } = useSharedFirestoreQuery<RunData>("personal-history:v2:" + uid, query, shouldListen);
  const day = useScoringDay();
  const { rules } = useRunningPointsRules();
  let current = score;
  if (!current && rules && !loading && (!error || data.length)) {
    let cached = summaryCache.get(data);
    if (cached?.day !== day || cached.score.rules !== rules) {
      cached = { day, score: activityPoints(data, undefined, rules) };
      summaryCache.set(data, cached);
    }
    current = cached.score;
  }

  const level = current && <span className="activity-level-indicator" role="img" aria-label={`Úroveň ${current.level}`}>
    <LevelShield level={current.level} tone={current.rank.tone}/>
  </span>;
  const points = current?.records.has(recordId) &&
    <ActivityLevelButton score={current} nickname={heading.nickname} recordId={recordId}/>;

  return <ActivityCardHeading {...heading} headingRef={headingRef} badge={level} points={points}/>;
}
