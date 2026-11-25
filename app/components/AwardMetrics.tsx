import { Award as AwardIcon, Bird, CalendarDays, Flame, ListChecks, Medal, Moon, Trophy } from "lucide-react";
import { pointsForAward } from "../lib/activityPoints";
import type { Award } from "../lib/awards";
import { formatMetricNumber } from "../lib/activityMetrics";
import Metric from "./Metric";

export function BadgeTotal({ count }: { count: number }) {
  return <span className="award-heading-total" aria-label={`Celkem ${count}`}>
    <AwardIcon size={19} aria-hidden="true" />
    {formatMetricNumber(count, 0)}
  </span>;
}

const awardIcons = {
  morning: Bird,
  night: Moon,
  first: Medal,
  month100: CalendarDays,
  month1000: CalendarDays,
  streak7: Flame,
  activities10: ListChecks,
  activities50: ListChecks,
} as const;

export function AwardGlyph({ id }: { id: string }) {
  const Icon = awardIcons[id as keyof typeof awardIcons] ?? Trophy;
  return <Icon aria-hidden="true"/>;
}

export default function AwardMetrics({ awards, label, scroll = false }: {
  awards: Award[];
  label: string;
  scroll?: boolean;
}) {
  return <div className="metric-group-ruled">
    <div data-metric-layout={scroll ? undefined : "summary"} className={scroll ? "award-metrics award-metrics-scroll" : "award-metrics app-metric-grid"}
      role="group" aria-label={label} tabIndex={scroll ? 0 : undefined}>
      {awards.map(award => {
        const reward = pointsForAward(award);
        return <Metric key={award.id} className={award.count ? "" : "is-locked"}
          icon={<AwardGlyph id={award.id}/>} tone={award.id === "night" ? "time" : "award"} label={award.title}
          value={award.repeatable ? formatMetricNumber(award.count, 0) : award.count ? "Splněno" : "Nesplněno"}
          unit={award.repeatable ? "×" : undefined} detail={<>{award.detail}{reward > 0 && <><br/>+{reward} {award.repeatable ? "body za odznak" : "bodů"}</>}</>}/>;
      })}
    </div>
  </div>;
}
