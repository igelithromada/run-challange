import { RUN_POINTS, activityPoints, levelThreshold } from "../lib/activityPoints";

const rules = RUN_POINTS;

function example(days: readonly number[]) {
  // Start on a Monday and fix the evaluation date to the last example day.
  const runs = days.map((km, index) => ({ id: String(index), km, timestamp: new Date(Date.UTC(2026, 10, 23 + index, 12)) }));
  return activityPoints(runs, runs.at(-1)?.timestamp.getTime());
}

export default function RunningPointsRules({ detailed = false }: { detailed?: boolean }) {
  const sample = example([5]);
  return <details className={detailed ? "tile running-points-rules running-points-rules-admin" : "running-points-rules"}>
    <summary>Pravidla bodování</summary>
    <ul>
      <li><strong>Vzdálenost.</strong> Běh od {rules.minimumKm} km získá {rules.perKm} bodů za kilometr a bonus za délku. Bonusová sazba roste do {rules.distanceBonusCapKm} km.</li>
      <li><strong>Pravidelnost.</strong> Bonus za běžecký den se počítá jednou denně a roste s počtem běžeckých dní od pondělí do neděle. Plný bonus získáš od {rules.fullDayBonusKm} km za den. Dny mohou být rozložené přes týden.</li>
      <li><strong>Pauza.</strong> Za každých dokončených {rules.inactivityDays} dní bez bodovaného běhu ubude {rules.inactivityPercent} % zbývajících bodů. Novým bodovaným během začíná nová lhůta.</li>
    </ul>
    <p>První běh týdne na 5 km přinese {sample.distancePoints} za vzdálenost + {sample.consistencyPoints} za pravidelnost = <strong>{sample.total} bodů</strong>.</p>
    {detailed && <>
      <dl>
        <dt>Body za jeden běh</dt>
        <dd>Zaokrouhli({rules.perKm} × km × (1 + min(km, {rules.distanceBonusCapKm}) / {rules.distanceDivisor})).</dd>
        <dt>Denní bonus</dt>
        <dd>Základ za první až sedmý běžecký den je {rules.weeklyBonuses.join(", ")} bodů. Denní bonus = zaokrouhli(základ × min(1, (denní km / {rules.fullDayBonusKm})²)), nejméně 1 bod. Denní kilometry jsou součet bodovaných běhů. Druhý běh téhož dne dostane pouze rozdíl proti už započtenému bonusu.</dd>
        <dt>Odečet a čas</dt>
        <dd>Za každé ukončené období bez běhu se stav násobí {((100 - rules.inactivityPercent) / 100).toLocaleString("cs-CZ")}. Běhy a odečty se počítají časově od nejstaršího záznamu. Zůstatek se zaokrouhlí až pro zobrazení a úroveň. Dny i týdny se počítají v pásmu Europe/Prague.</dd>
        <dt>Úrovně</dt>
        <dd>Úroveň n začíná na {rules.levelFactor} × n × (n − 1) bodech. Úroveň 2 je od {levelThreshold(2)} bodů, úroveň 3 od {levelThreshold(3)} a úroveň 5 od {levelThreshold(5)}.</dd>
      </dl>
      <ul>
        <li>Jeden běh na 10 km získá {example([10]).total} bodů. Pět běhů po 2 km v různých dnech získá {example(Array(5).fill(2)).total} bodů.</li>
        <li>Dva běhy po 20 km v různých dnech získají {example([20, 20]).total} bodů. Sedm běhů po 5 km získá {example(Array(7).fill(5)).total} bodů.</li>
      </ul>
    </>}
  </details>;
}
