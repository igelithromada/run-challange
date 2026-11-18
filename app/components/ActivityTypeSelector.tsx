"use client";

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
  // Workout Squats: Hugeicons (MIT). Push Up: Icon Pantry (free app use).
  // Shared by forms, results, profiles, galleries, teams and challenges.
  if (type === "dřepy" || type === "kliky") {
    return (
      <svg className="activity-type-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {type === "dřepy" ? <>
          <circle cx="11.5" cy="4.5" r="1.5" />
          <path d="m10.948 21 1.13-3.41c.404-1.215.606-1.823.304-2.244-.301-.42-.94-.42-2.215-.42H8.933m0 0H7.925c-.948 0-1.423 0-1.725-.373-.302-.374-.216-.793-.043-1.633.29-1.406.872-3.153 1.935-4.341.294-.328.44-.492.763-.56s.581.05 1.097.286l1.862.85.783.358c.92.42 1.38.63 1.865.608s.924-.275 1.802-.779L18 8.345m-9.067 6.58c.241-1.315 1.155-4.312 2.88-5.77" />
        </> : <>
          <circle cx="19.5" cy="9.5" r="1.8" />
          <path d="M17 12.5 3 18m13.5-5.2V18M2 21h20" />
        </>}
      </svg>
    );
  }
  return <Footprints className="activity-type-icon" size={size} strokeWidth={2.7} aria-hidden="true" />;
}

export default function ActivityTypeSelector({
  value,
  onChange,
  ariaLabel = "Typ aktivity",
  disabled = false,
}: {
  value: ActivityType;
  onChange: (value: ActivityType) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="activity-type-selector" role="group" aria-label={ariaLabel}>
      {ACTIVITY_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={value === type ? "active" : ""}
          disabled={disabled}
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
