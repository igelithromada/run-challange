import type { ReactNode } from "react";

/** Shared two-line measurement, used for records, summaries and results. */
export default function Metric({ icon, label, value, detail, className = "", title }: {
  icon: ReactNode; label: string; value: ReactNode; detail?: ReactNode; className?: string; title?: string;
}) {
  return <div className={`app-metric ${className}`} title={title}>
    <div className="app-metric-heading"><span className="app-metric-icon" aria-hidden="true">{icon}</span><span>{label}</span></div>
    <strong className="app-metric-value">{value}</strong>
    {detail && <small className="app-metric-detail">{detail}</small>}
  </div>;
}
