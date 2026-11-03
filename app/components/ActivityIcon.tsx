import React from "react";

type ActivityIconProps = { type: "run" | "walk"; size?: number };

export default function ActivityIcon({ type, size = 25 }: ActivityIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="activity-type-icon"
    >
      {type === "run" ? (
        <>
          <circle cx="33" cy="7.5" r="4.5" fill="currentColor" />
          <path d="M23 15.5c2.4-2 5.5-1.5 7.2.8l3.2 4.2 7.1-2.2a3.4 3.4 0 0 1 2 6.5l-9.4 3a4.2 4.2 0 0 1-4.6-1.5l-1.3-1.7-3.4 8.1 7.6 6.2a3.5 3.5 0 0 1-4.4 5.4l-9.6-7.8a4.2 4.2 0 0 1-1.2-4.8l2.2-5.2-5.1 1.4 1.3 6.3a3.5 3.5 0 1 1-6.8 1.5l-2-9.2a4.2 4.2 0 0 1 3-4.9l10.1-2.8 2.1-4.3Z" fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx="25" cy="7.5" r="4.5" fill="currentColor" />
          <path d="M22 15.5c2.8-1.3 5.8-.1 6.7 2.7l2.1 7.1 6.5 3.2a3.4 3.4 0 0 1-3 6.1l-7.7-3.8a4.2 4.2 0 0 1-2.1-2.5l-1.1-3.6-4.1 6.2 5.1 8a3.5 3.5 0 1 1-5.9 3.8l-6.3-9.8a4.2 4.2 0 0 1 .1-4.6l4.5-6.8-5.2 2.1-3.1 6.1a3.5 3.5 0 0 1-6.2-3.2l4-7.8a4.2 4.2 0 0 1 2.1-1.9l8.8-3.6Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
