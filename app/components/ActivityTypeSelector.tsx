"use client";

import React from "react";
import { Footprints } from "lucide-react";
import { ACTIVITY_TYPES, activityLabel } from "../lib/activity";
import type { ActivityType } from "../types";

export type { ActivityType } from "../types";


export function ActivityTypeIcon({ type, size = 25 }: { type: ActivityType; size?: number }) {
  if (type === "běh") {
    return (
      <img
        className="activity-type-icon activity-type-icon-run"
        src="/run-icon-white.png"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
      />
    );
  }
  if (type === "dřepy" || type === "kliky") return <svg className="activity-type-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === "dřepy" ? <><circle cx="19" cy="5" r="3"/><path d="M18 10l-4 8 9 4-3 7h7M15 17l-9 6 4 6h5M17 11l-7 2-5-3"/></> : <><circle cx="26" cy="9" r="3"/><path d="M23 14L9 19l-6 8h7M21 15l3 7-3 5h8M9 19l-5-4"/></>}</svg>;
  return <Footprints className="activity-type-icon" size={size} strokeWidth={2.7} aria-hidden="true" />;
}

export default function ActivityTypeSelector({
  value,
  onChange,
  ariaLabel = "Typ aktivity",
}: {
  value: ActivityType;
  onChange: (value: ActivityType) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="activity-type-selector" role="group" aria-label={ariaLabel}>
      {ACTIVITY_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={value === type ? "active" : ""}
          aria-pressed={value === type}
          onClick={() => onChange(type)}
        >
          <ActivityTypeIcon type={type} />
          <span>{activityLabel(type)}</span>
        </button>
      ))}
    </div>
  );
}
