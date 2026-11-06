export type ActivityMetric = { km: number; minutes: number; pace: number; count: number };

export const numberValue = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const activityMetrics = (runs: Array<{ km?: unknown; minuty?: unknown }>): ActivityMetric => {
  const km = runs.reduce((sum, run) => sum + numberValue(run.km), 0);
  const minutes = runs.reduce((sum, run) => sum + numberValue(run.minuty), 0);
  return { km, minutes, pace: km > 0 ? minutes / km : 0, count: runs.length };
};

export const formatPace = (pace: number) => {
  if (!Number.isFinite(pace) || pace <= 0) return "—";
  const seconds = Math.round(pace * 60);
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, "0")}″ /km`;
};
