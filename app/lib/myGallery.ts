import { parseActivityDate } from "./runData";
import type { ActivityType, RunData } from "../types";
export type GalleryPhoto = {
  key: string;
  runId: string;
  url: string;
  date: Date | null;
  km: number;
  type: ActivityType;
};
export function myGalleryPhotos(
  runs: RunData[],
  uid: string,
  type: ActivityType | "all" = "all",
  from = "",
  to = "",
): GalleryPhoto[] {
  if (!uid) return [];
  const start = from ? Date.parse(from + "T00:00:00") : -Infinity,
    end = to ? Date.parse(to + "T23:59:59.999") : Infinity;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];
  const photos: GalleryPhoto[] = [];
  for (const run of runs) {
    if (run.uid !== uid || ("deleting" in run && run.deleting === true))
      continue;
    const activityType = run.type === "chůze" ? "chůze" : "běh";
    if (type !== "all" && activityType !== type) continue;
    const date = parseActivityDate(run.timestamp);
    if (
      (from || to) &&
      (!date || date.getTime() < start || date.getTime() > end)
    )
      continue;
    const images =
      Array.isArray(run.imageUrls) && run.imageUrls.length
        ? run.imageUrls
        : [run.imageUrl];
    for (const [index, url] of Array.from(
      new Set(
        images.filter(
          (value): value is string =>
            typeof value === "string" && !!value.trim(),
        ),
      ),
    ).entries()) {
      if (!/^https:\/\//.test(url)) continue;
      photos.push({
        key: `${run.id}:${index}:${url}`,
        runId: run.id,
        url,
        date,
        km: Number(run.km) || 0,
        type: activityType,
      });
    }
  }
  return photos.sort(
    (a, b) =>
      (b.date?.getTime() || 0) - (a.date?.getTime() || 0) ||
      a.runId.localeCompare(b.runId),
  );
}
