import type { ComponentPropsWithRef, ReactNode } from "react";

export default function RecordCard({ className = "", ...props }: ComponentPropsWithRef<"article">) {
  return <article {...props} className={`tile list-tile activity-card activity-card-modern ${className}`.trim()}/>;
}

export function RecordMetrics({ children, layout = "row" }: {
  children: ReactNode; layout?: "row" | "summary";
}) {
  return <div data-metric-layout={layout} className={layout === "row" ? "activity-metrics" : "app-metric-grid"}>{children}</div>;
}
