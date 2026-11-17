import { activityAmount } from "./activity";
import { parseActivityDate } from "./runData";
import type { ActivityType, RunData } from "../types";

export function progressComparison(runs: Pick<RunData, "type" | "km" | "repetitions" | "timestamp">[], type: ActivityType, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  let current = 0, previous = 0, currentCount = 0, previousCount = 0;
  for (const run of runs) {
    if ((run.type || "běh") !== type) continue;
    const date = parseActivityDate(run.timestamp), amount = activityAmount(run);
    if (!date || amount <= 0) continue;
    if (date >= start && date <= now) { current += amount; currentCount++; }
    if (date >= previousStart && date <= previousEnd) { previous += amount; previousCount++; }
  }
  const delta = current - previous;
  return { current, previous, currentCount, previousCount, delta, percent: previous > 0 ? delta / previous * 100 : null, start, previousStart, previousEnd };
}
