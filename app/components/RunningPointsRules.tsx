import { activityPoints, levelThreshold } from "../lib/activityPoints";
import { RUN_POINTS, type RunningPointsConfig } from "../lib/runningPointsConfig";

function example(days: readonly number[], rules: RunningPointsConfig) {
  // Start on a Monday and fix the evaluation date to the last example day.
  const runs = days.map((km, index) => ({ id: String(index), km, timestamp: new Date(Date.UTC(2026, 10, 23 + index, 12)) }));
  return activityPoints(runs, runs.at(-1)?.timestamp.getTime(), rules);
}

export default function RunningPointsRules({ detailed = false, rules = RUN_POINTS }: { detailed?: boolean; rules?: RunningPointsConfig }) {
  const first = example([5], rules).records.get("0");
  const second = example([5, 5], rules).records.get("1");
  const hasBonus = rules.weeklyBonuses.some(bonus => bonus > 0);
  return <details className="running-points-rules">
    <summary>{detailed ? "Přesný výpočet a příklady" : "Pravidla bodování"}</summary>
    <ul>
      <li><strong>Vzdálenost.</strong> Od {rules.minimumKm} km získáváš {rules.perKm} bodů za kilometr.
        {rules.distanceBonusCapKm > 0 && ` Bonus za délku roste do ${rules.distanceBonusCapKm} km.`}</li>
      <li><strong>Pravidelnost.</strong> {hasBonus
        ? `První běžecký den týdne je bez bonusu. Za další dny nejvýš jeden bonus denně, v plné výši od ${rules.fullDayBonusKm} km za den.`
        : "Bonus je vypnutý."}</li>
      {rules.inactivityPercent > 0 && <li><strong>Pauza.</strong> Každých {rules.inactivityDays} dní bez bodovaného běhu ubude {rules.inactivityPercent} % zbývajících bodů.</li>}
    </ul>
    {first && second && <p>První den na 5 km dá <strong>{first.distancePoints} bodů</strong>.
      {second.consistencyPoints > 0 && <> Druhý den na 5 km dá {second.distancePoints} + {second.consistencyPoints} = <strong>{second.distancePoints + second.consistencyPoints} bodů</strong>.</>}
    </p>}
    {detailed && <>
      <dl>
        <dt>Body za jeden běh</dt>
        <dd>Zaokrouhli({rules.perKm} × km × (1 + min(km, {rules.distanceBonusCapKm}) / {rules.distanceDivisor})).</dd>
        <dt>Denní bonus</dt>
        <dd>Základ za první až sedmý běžecký den je {rules.weeklyBonuses.join(", ")} bodů. Denní bonus = zaokrouhli(základ × min(1, (denní km / {rules.fullDayBonusKm})²)), nejméně 1 bod při kladné sazbě. Denní kilometry jsou součet bodovaných běhů. Druhý běh téhož dne dostane pouze rozdíl proti už započtenému bonusu.</dd>
        <dt>Odečet a čas</dt>
        <dd>Za každé ukončené období bez běhu se stav násobí {((100 - rules.inactivityPercent) / 100).toLocaleString("cs-CZ")}. Běhy a odečty se počítají časově od nejstaršího záznamu. Zůstatek se zaokrouhlí až pro zobrazení a úroveň. Dny i týdny se počítají v pásmu Europe/Prague.</dd>
        <dt>Úrovně</dt>
        <dd>Úroveň n začíná na {rules.levelFactor} × n × (n − 1) bodech. Úroveň 2 je od {levelThreshold(2, rules)} bodů, úroveň 3 od {levelThreshold(3, rules)} a úroveň 5 od {levelThreshold(5, rules)}.</dd>
      </dl>
      <ul>
        <li>Jeden běh na 10 km získá {example([10], rules).total} bodů. Pět běhů po 2 km v různých dnech získá {example(Array(5).fill(2), rules).total} bodů.</li>
        <li>Dva běhy po 20 km v různých dnech získají {example([20, 20], rules).total} bodů. Sedm běhů po 5 km získá {example(Array(7).fill(5), rules).total} bodů.</li>
      </ul>
    </>}
  </details>;
}
