import type { ReactNode } from "react";

import { activityLabel, isStrengthActivity } from "../lib/activity";
import { formatCompactActivityTime, formatMetricNumber, numberValue } from "../lib/activityMetrics";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
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
  const avatar = avatarUrl
    ? <img src={cloudinaryImageUrl(avatarUrl, 128)} alt="" loading="lazy" decoding="async" />
    : nickname.charAt(0).toUpperCase();

  return <RecordCardHeading
    avatar={onUserClick
      ? <button type="button" className="activity-avatar" onClick={onUserClick} aria-label={`Profil uživatele ${nickname}`}>{avatar}</button>
      : <span className="activity-avatar" aria-hidden="true">{avatar}</span>}
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

    <div data-metric-layout="row" className={strength ? "activity-metrics strength-metrics" : "activity-metrics"}>
      {strength
        ? <Metric icon={<ActivityTypeIcon type={activityType}/>} label="Opakování" tone="repetitions" value={formatMetricNumber(numberValue(run.repetitions), 0)}/>
        : <Metric label="Vzdálenost" tone="distance" value={formatMetricNumber(numberValue(run.km))} unit="km"/>}
      {(!strength || Number(run.minuty) > 0) && <Metric label="Čas" tone="time" value={formatCompactActivityTime(Number(run.minuty))}/>}
      {!strength && <Metric label="Tempo" tone="pace" value={formatCompactActivityTime(Number(run.tempo))} unit="/km"/>}
    </div>
  </>;
}
