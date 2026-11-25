import type { ReactNode } from "react";

import { ChevronRight, Clock3, Gauge, MapPin } from "lucide-react";

const standardIcons: Partial<Record<MetricTone, ReactNode>> = { distance: <MapPin/>, time: <Clock3/>, pace: <Gauge/> };

type MetricTone = "distance" | "time" | "pace" | "repetitions" | "count" | "target" | "success" | "award";

/** Shared measurement: icon and label above a value and optional supporting detail. */
export default function Metric({ icon, label, value, unit, detail, tone, className = "", title, href }: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  tone?: MetricTone;
  className?: string;
  title?: string;
  href?: string;
}) {
  const content = <>
    <div className="app-metric-heading"><span className="app-metric-icon" aria-hidden="true">{icon ?? (tone && standardIcons[tone])}</span><span>{label}</span>{href && <ChevronRight className="app-metric-link-arrow" size={15} aria-hidden="true"/>}</div>
    <strong className="app-metric-value">{value}{unit && <> <small className="app-metric-unit">{unit}</small></>}</strong>
    {detail && <small className="app-metric-detail">{detail}</small>}
  </>;
  const classes = `app-metric ${className}`.trim();
  return href
    ? <a href={href} className={classes + " app-metric-link"} data-metric-tone={tone} title={title}>{content}</a>
    : <div className={classes} data-metric-tone={tone} title={title}>{content}</div>;
}
