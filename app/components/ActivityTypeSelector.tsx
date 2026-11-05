"use client";

import React from "react";
import { Footprints } from "lucide-react";

export type ActivityType = "běh" | "chůze";

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
      {(["běh", "chůze"] as ActivityType[]).map((type) => (
        <button
          key={type}
          type="button"
          className={value === type ? "active" : ""}
          onClick={() => onChange(type)}
        >
          <ActivityTypeIcon type={type} />
          <span>{type === "běh" ? "Běh" : "Chůze"}</span>
        </button>
      ))}
    </div>
  );
}
