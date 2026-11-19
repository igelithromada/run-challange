"use client";
import { sharedChallenge, quantityChallenge, challengeUnit } from "../lib/challengeMeasurement";
import { activityLabel } from "../lib/activity";

import Metric from "./Metric";
import { RecordCardHeading } from "./ActivityCardContent";
import { formatMetricNumber } from "../lib/activityMetrics";
import Link from "next/link";
import { CalendarDays, ChevronRight, Target, Users } from "lucide-react";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import type { ChallengeData } from "../types";

type Props = { challenge: ChallengeData; joined: boolean; authorName?: string; detail?: boolean };

const kindLabel = (kind: ChallengeData["kind"]) => kind === "repetitions" ? "Počet opakování" : kind === "distance" ? "Vzdálenost" : kind === "activities" ? "Počet aktivit" : kind === "activeDays" ? "Aktivní dny" : "Společný cíl";
const dateLabel = (value: string, year = false) => new Date(value + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", ...(year ? { year: "numeric" as const } : {}) });

export default function ChallengeSummaryCard({ challenge, joined, authorName, detail = false }: Props) {
  const Heading = detail ? "h1" : "h3";
  const distance = quantityChallenge(challenge.kind);
  const unit = challengeUnit(challenge.kind);
  const goal = Number(challenge.goal);
  const total = Number(challenge.sharedProgress || 0);
  const state = challenge.state === "active" ? "Probíhá" : challenge.state === "planned" ? "Plánovaná" : "Dokončená";
  const period = `${dateLabel(challenge.startDate, true)} – ${dateLabel(challenge.endDate, true)}`;
  const content = <>
    <RecordCardHeading title={<Heading>{challenge.name}</Heading>}
      avatar={<span className="activity-avatar" aria-hidden="true">
        {challenge.avatarUrl ? <img src={cloudinaryImageUrl(challenge.avatarUrl, 96)} alt="" loading="lazy" decoding="async"/> : <Target size={22}/>}
      </span>}
      meta={<span className="challenge-state-label">{state}</span>}
    >
      <small className="challenge-activity-label activity-kind-label"><ActivityTypeIcon type={challenge.activityType} size={16}/>{activityLabel(challenge.activityType)}</small>
    </RecordCardHeading>
    {challenge.description && <div className={detail ? "activity-description" : "activity-description challenge-summary-description"}>{challenge.description}</div>}
    {detail && <div data-metric-layout="summary" className="app-metric-grid challenge-summary-metrics">
      <Metric icon={<Target size={19}/>} label="Cíl" tone="target" value={formatMetricNumber(goal, distance ? 1 : 0)} unit={unit}/>
      <Metric icon={<Users size={19}/>} label="Účastníci" tone="count" value={Number(challenge.participantCount || 0)}/>
    </div>}
    <p className="challenge-period-line"><CalendarDays size={17} aria-hidden="true"/><span>{period}</span></p>
    {detail && sharedChallenge(challenge.kind) && <div className="challenge-shared-progress">
      <span>Společně {total.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} z {goal.toLocaleString("cs-CZ")} {unit}</span>
      <progress max={goal > 0 ? goal : 1} value={Math.min(Math.max(0, total), goal > 0 ? goal : 1)} aria-label="Plnění společného cíle" />
    </div>}
    <footer className="activity-card-actions record-summary-footer">
      <span>{joined ? "Účastníš se · " : ""}{kindLabel(challenge.kind)}</span>
      {detail ? (authorName && <span>Autor: {authorName}</span>) : <span className="record-detail-link">Detail výzvy <ChevronRight size={16} aria-hidden="true" /></span>}
    </footer>
  </>;
  return <article className={`tile activity-card activity-card-modern record-summary-card challenge-summary-card${detail ? " challenge-summary-detail" : ""}`}>
    {detail ? content : <Link href={`/challenges/${encodeURIComponent(challenge.id)}`} className="record-summary-link">{content}</Link>}
  </article>;
}
