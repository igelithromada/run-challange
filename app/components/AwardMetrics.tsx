import { Bird, CalendarDays, Moon } from "lucide-react";
import type { Award } from "../lib/awards";
import Metric from "./Metric";

export default function AwardMetrics({ awards, label, scroll = false }: {
  awards: Award[];
  label: string;
  scroll?: boolean;
}) {
  return <div className={scroll ? "award-metrics award-metrics-scroll" : "award-metrics"}
    role="group" aria-label={label} tabIndex={scroll ? 0 : undefined}>
    {awards.map(award => {
      const icon = award.id === "morning" ? <Bird/> : award.id === "night" ? <Moon/>
        : award.id === "month100" || award.id === "month1000" ? <CalendarDays/> : award.icon;
      return <Metric key={award.id} className={`award-metric${award.count ? "" : " is-locked"}`}
        icon={icon} label={award.title}
        value={award.repeatable ? `${award.count.toLocaleString("cs-CZ")}×` : award.count ? "Splněno" : "Zatím nesplněno"}
        detail={award.detail}/>;
    })}
  </div>;
}
