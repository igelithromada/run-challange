export type RouteSample = {
  coordinate: [number, number];
  elevation: number | null;
  distanceKm: number;
};
export function routeDistance(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180,
    dLat = (b[1] - a[1]) * rad,
    dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function routeSamples(
  coordinates: [number, number][],
  elevations: (number | null)[],
  laps = 1,
): RouteSample[] {
  const samples: RouteSample[] = [];
  let distanceKm = 0;
  const count = Math.min(10, Math.max(1, Math.floor(laps) || 1));
  for (let lap = 0; lap < count; lap++)
    for (let i = 0; i < coordinates.length; i++) {
      if (i > 0)
        distanceKm += routeDistance(coordinates[i - 1], coordinates[i]);
      samples.push({
        coordinate: coordinates[i],
        elevation:
          typeof elevations[i] === "number" && Number.isFinite(elevations[i])
            ? elevations[i]
            : null,
        distanceKm,
      });
    }
  return samples;
}
export function nearestDistance(samples: RouteSample[], target: number) {
  if (!samples.length) return -1;
  let lo = 0,
    hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].distanceKm < target) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 &&
    target - samples[lo - 1].distanceKm <= samples[lo].distanceKm - target
    ? lo - 1
    : lo;
}
/** Preserve peaks and dips when displaying a long GPX, while selection uses every original point. */
export function profileDisplay(samples: RouteSample[], buckets = 250) {
  if (samples.length <= buckets * 2) return samples;
  const result: RouteSample[] = [samples[0]];
  for (
    let start = 1;
    start < samples.length - 1;
    start += Math.ceil(samples.length / buckets)
  ) {
    const end = Math.min(
      samples.length - 1,
      start + Math.ceil(samples.length / buckets),
    );
    let low = start,
      high = start;
    for (let i = start; i < end; i++) {
      if (
        (samples[i].elevation ?? Infinity) <
        (samples[low].elevation ?? Infinity)
      )
        low = i;
      if (
        (samples[i].elevation ?? -Infinity) >
        (samples[high].elevation ?? -Infinity)
      )
        high = i;
    }
    for (const i of [...new Set([low, high])].sort((a, b) => a - b))
      result.push(samples[i]);
  }
  result.push(samples[samples.length - 1]);
  return result;
}

/** Interpolate the point under the finger even when a GPX segment has sparse samples. */
export function routePointAtDistance(
  samples: RouteSample[],
  distanceKm: number,
): RouteSample | null {
  const nearest = nearestDistance(samples, distanceKm);
  if (nearest < 0) return null;
  const target = Math.max(0, Math.min(samples.at(-1)!.distanceKm, distanceKm));
  const before =
    samples[nearest].distanceKm <= target ? nearest : Math.max(0, nearest - 1);
  const after = Math.min(samples.length - 1, before + 1),
    a = samples[before],
    b = samples[after];
  if (target <= a.distanceKm || b.distanceKm <= a.distanceKm) return a;
  const t = (target - a.distanceKm) / (b.distanceKm - a.distanceKm);
  const lonDelta = ((b.coordinate[0] - a.coordinate[0] + 540) % 360) - 180;
  return {
    distanceKm: target,
    coordinate: [
      ((a.coordinate[0] + lonDelta * t + 540) % 360) - 180,
      a.coordinate[1] + (b.coordinate[1] - a.coordinate[1]) * t,
    ],
    elevation:
      a.elevation === null || b.elevation === null
        ? null
        : a.elevation + (b.elevation - a.elevation) * t,
  };
}
