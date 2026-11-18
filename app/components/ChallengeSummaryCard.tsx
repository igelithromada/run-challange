"use client";
import { sharedChallenge, quantityChallenge, challengeUnit } from "../lib/challengeMeasurement";
import { activityLabel } from "../lib/activity";

import Metric from "./Metric";
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
    <header className="activity-card-top">
      <div className="activity-avatar">
        {challenge.avatarUrl ? <img src={cloudinaryImageUrl(challenge.avatarUrl, 96)} alt="" loading="lazy" /> : <Target size={22} aria-hidden="true" />}
      </div>
      <div className="activity-person">
        <Heading>{challenge.name}</Heading>
        <small className="challenge-activity-label"><ActivityTypeIcon type={challenge.activityType} size={16} />{activityLabel(challenge.activityType)}</small>
      </div>
      <span className="activity-date challenge-state-label">{state}</span>
    </header>
    {challenge.description && <div className={detail ? "activity-description" : "activity-description challenge-summary-description"}>{challenge.description}</div>}
    <div className="app-metric-grid challenge-summary-metrics">
      <Metric icon={<Target size={19}/>} label="Cíl" value={<>{goal.toLocaleString("cs-CZ", { maximumFractionDigits: distance ? 1 : 0 })} <small>{unit}</small></>}/>
      <Metric icon={<Users size={19}/>} label="Účastníci" value={Number(challenge.participantCount || 0)}/>
    </div>
    <p className="challenge-period-line"><CalendarDays size={17} aria-hidden="true"/><span>{period}</span></p>
    {sharedChallenge(challenge.kind) && <div className="challenge-shared-progress">
      <span>Společně {total.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} z {goal.toLocaleString("cs-CZ")} {unit}</span>
      <progress max={goal > 0 ? goal : 1} value={Math.min(Math.max(0, total), goal > 0 ? goal : 1)} aria-label="Plnění společného cíle" />
    </div>}
    <footer className="activity-card-actions challenge-summary-footer">
      <span>{joined ? "Účastníš se · " : ""}{kindLabel(challenge.kind)}</span>
      {detail ? (authorName && <span>Autor: {authorName}</span>) : <span className="challenge-open-hint">Detail <ChevronRight size={16} aria-hidden="true" /></span>}
    </footer>
  </>;
  return <article className={`tile list-tile activity-card activity-card-modern challenge-summary-card${detail ? " challenge-summary-detail" : ""}`}>
    {detail ? content : <Link href={`/challenges/${encodeURIComponent(challenge.id)}`} className="challenge-summary-link">{content}</Link>}
  </article>;
}
