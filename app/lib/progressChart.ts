import { parseActivityDate } from "./runData";
export type ChartRun = {
  id: string;
  km: number | string;
  minuty: number | string;
  timestamp?: unknown;
};
export type ProgressPoint = {
  id: string;
  time: number;
  km: number;
  minutes: number;
  totalKm: number;
  totalMinutes: number;
  count: number;
  completeTime: boolean;
};
export function progressPoints(
  runs: ChartRun[],
  from: string,
  to: string,
  now = Date.now(),
): ProgressPoint[] {
  const start = Date.parse(from + "T00:00:00"),
    end = Math.min(Date.parse(to + "T23:59:59.999"), now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
    return [];
  const sorted = runs
    .map((run) => ({
      ...run,
      time: parseActivityDate(run.timestamp)?.getTime(),
      km: Number(run.km),
      minutes: Number(run.minuty),
    }))
    .filter(
      (run): run is typeof run & { time: number } =>
        typeof run.time === "number" &&
        run.time >= start &&
        run.time <= end &&
        Number.isFinite(run.km) &&
        run.km > 0,
    )
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  let totalKm = 0,
    totalMinutes = 0,
    completeTime = true;
  return sorted.map((run, index) => {
    totalKm += run.km;
    const minutes =
      Number.isFinite(run.minutes) && run.minutes > 0 ? run.minutes : 0;
    totalMinutes += minutes;
    completeTime = completeTime && minutes > 0;
    return {
      id: run.id,
      time: run.time,
      km: run.km,
      minutes,
      totalKm,
      totalMinutes,
      count: index + 1,
      completeTime,
    };
  });
}
export function nearestProgressPoint(
  points: ProgressPoint[],
  start: number,
  end: number,
  ratio: number,
  heightRatio = 0.5,
) {
  let best = -1,
    score = Infinity;
  const max = points.at(-1)?.totalKm || 1,
    target = start + Math.max(0, Math.min(1, ratio)) * (end - start);
  for (let i = 0; i < points.length; i++) {
    const next =
      (Math.abs(points[i].time - target) / Math.max(1, end - start)) * 1000 +
      Math.abs(1 - points[i].totalKm / max - heightRatio) * 0.01;
    if (next < score) {
      score = next;
      best = i;
    }
  }
  return best;
}
