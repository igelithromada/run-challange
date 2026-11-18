import { isStrengthActivity, recordActivityType } from "./activity";
export type ActivityMetric = { km: number; repetitions:number; minutes: number; pace: number; count: number };

export const numberValue = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const activityMetrics = (runs: Array<{ km?: unknown; repetitions?:unknown; type?:string; activityType?:string; minuty?: unknown }>): ActivityMetric => {
  const km = runs.reduce((sum, run) => sum + (isStrengthActivity(recordActivityType(run)) ? 0 : numberValue(run.km)), 0);
  const minutes = runs.reduce((sum, run) => sum + numberValue(run.minuty), 0);
  return { km, repetitions: runs.reduce((sum, run) => sum + (isStrengthActivity(recordActivityType(run)) ? numberValue(run.repetitions) : 0), 0), minutes, pace: km > 0 ? runs.filter(run => !isStrengthActivity(recordActivityType(run))).reduce((sum, run) => sum + numberValue(run.minuty), 0) / km : 0, count: runs.length };
};

export const formatMetricNumber = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("cs-CZ", { maximumFractionDigits });

export function formatCompactActivityTime(minutes: number) {
  const seconds = Math.max(0, Math.round(numberValue(minutes) * 60));
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, "0")}″`;
}
