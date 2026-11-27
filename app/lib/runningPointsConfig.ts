export const RUN_POINT_FIELDS = [
  { key: "minimumKm", label: "Bodovaný běh od (km)", min: 0.1, max: 100, step: 0.1 },
  { key: "perKm", label: "Základní body za kilometr", min: 1, max: 100, step: 1 },
  { key: "distanceBonusCapKm", label: "Bonus za délku roste do (km)", min: 0, max: 1000, step: 1 },
  { key: "distanceDivisor", label: "Dělitel bonusu za délku", min: 1, max: 1000, step: 1 },
  { key: "fullDayBonusKm", label: "Plný denní bonus od (km)", min: 0.1, max: 1000, step: 0.1 },
  { key: "inactivityDays", label: "Interval odečtu (dny)", min: 1, max: 365, step: 1 },
  { key: "inactivityPercent", label: "Odečet za interval (%)", min: 0, max: 100, step: 1 },
  { key: "levelFactor", label: "Koeficient úrovní", min: 1, max: 10_000, step: 1 },
] as const;

export const MAX_DAILY_BONUS = 1000;

type RuleNumbers = Record<(typeof RUN_POINT_FIELDS)[number]["key"], number>;
export type RunningPointsConfig = RuleNumbers & { weeklyBonuses: readonly number[] };

export const RUN_POINTS: RunningPointsConfig = {
  minimumKm: 1,
  perKm: 5,
  distanceBonusCapKm: 20,
  distanceDivisor: 60,
  fullDayBonusKm: 5,
  weeklyBonuses: [0, 5, 5, 10, 15, 20, 25],
  inactivityDays: 30,
  inactivityPercent: 10,
  levelFactor: 50,
};

export function parseRunningPointsConfig(input: unknown): RunningPointsConfig | null {
  if (!input || typeof input !== "object") return null;
  const values = input as Record<string, unknown>;
  const rules = { ...RUN_POINTS };
  for (const { key, min, max, step } of RUN_POINT_FIELDS) {
    const value = values[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
        (step === 1 && !Number.isInteger(value))) return null;
    rules[key] = value;
  }
  const bonuses = values.weeklyBonuses;
  if (!Array.isArray(bonuses) || bonuses.length !== 7 || bonuses[0] !== 0 ||
      bonuses.some(bonus => !Number.isInteger(bonus) || bonus < 0 || bonus > MAX_DAILY_BONUS)) return null;
  rules.weeklyBonuses = bonuses;
  return rules;
}
