import UserAvatar from "./UserAvatar";
import type { ReactNode } from "react";

import { activityLabel, isStrengthActivity } from "../lib/activity";
import { formatCompactActivityTime, formatMetricNumber, numberValue } from "../lib/activityMetrics";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import { RecordMetrics } from "./RecordCard";
import Metric from "./Metric";

export function ActivityCardHeading({ nickname, avatarUrl, activityType, date, badge, teamName, teamAvatarUrl, onUserClick }: {
  nickname: string;
  avatarUrl?: string;
  activityType: string;
  date: Date | null;
  badge?: ReactNode;
  teamName?: string | null;
  teamAvatarUrl?: string;
  onUserClick?: () => void;
}) {
  return <RecordCardHeading
    avatar={<UserAvatar name={nickname} url={avatarUrl} onClick={onUserClick}/>}
    title={<span onClick={onUserClick} onKeyDown={e => e.key === "Enter" && onUserClick?.()} role={onUserClick ? "link" : undefined} tabIndex={onUserClick ? 0 : undefined}>{nickname}</span>}
    badge={badge}
    meta={date && <time className="activity-date" dateTime={date.toISOString()}>
      {date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
    </time>}
  >
    <small className="activity-kind-label">{activityLabel(activityType)}</small>
    {teamName && <small className="activity-team-line"><span className="activity-team-avatar">{teamAvatarUrl ? <img src={cloudinaryImageUrl(teamAvatarUrl, 48)} alt="" loading="lazy" decoding="async" /> : "T"}</span><b>Tým</b> · {teamName}</small>}
  </RecordCardHeading>;
}

export function RecordCardHeading({ avatar, title, badge, meta, children }: {
  avatar: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return <header className="activity-card-top record-card-heading">
    {avatar}
    <div className="activity-person">
      <div className="record-card-title-row">
        <div className="activity-person-name">{title}{badge}</div>
        {meta && <div className="activity-record-byline">{meta}</div>}
      </div>
      {children}
    </div>
  </header>;
}

export function ActivityCardStats({ activityType, run }: {
  activityType: string;
  run: { description?: string; km: number | string; minuty: number | string; tempo: number | string; repetitions?: number };
}) {
  const strength = isStrengthActivity(activityType);
  return <>
    {run.description?.trim() && <div className="activity-description">{run.description.trim()}</div>}

    <RecordMetrics>
      {strength
        ? <Metric icon={<ActivityTypeIcon type={activityType}/>} label="Opakování" tone="repetitions" value={formatMetricNumber(numberValue(run.repetitions), 0)}/>
        : <Metric label="Vzdálenost" tone="distance" value={formatMetricNumber(numberValue(run.km))} unit="km"/>}
      {(!strength || Number(run.minuty) > 0) && <Metric label="Čas" tone="time" value={formatCompactActivityTime(Number(run.minuty))}/>}
      {!strength && <Metric label="Tempo" tone="pace" value={formatCompactActivityTime(Number(run.tempo))} unit="/km"/>}
    </RecordMetrics>
  </>;
}
