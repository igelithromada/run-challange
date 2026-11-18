/** Metre-scale coordinates retain local terrain differences without GPS float noise. */
export function weatherCoordinates(latitude: number, longitude: number) {
  return { lat: Number(latitude.toFixed(5)), lon: Number(longitude.toFixed(5)) };
}

export function weatherLocationName(address: Record<string, unknown>): string | null {
  const first = (...keys: string[]) => keys.map(key => address[key])
    .find((value): value is string => typeof value === "string" && !!value.trim())?.trim();
  const place = first("village", "town", "city", "municipality");
  const area = first("suburb", "city_district", "quarter", "neighbourhood", "hamlet");
  if (!place) return area?.slice(0, 180) || null;
  if (!area) return place.slice(0, 180);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs");
  // Some providers already return e.g. Ostrava-Poruba in one address component.
  const city = normalize(place), district = normalize(area);
  return (district.includes(city) ? area : city.includes(district) ? place : `${place} · ${area}`).slice(0, 180);
}

/** Ignore GPS jitter; re-resolve the forecast after a meaningful move. */
export function weatherLocationMoved(previous: { lat: number; lon: number } | null, next: { lat: number; lon: number }) {
  if (!previous) return true;
  const radians = Math.PI / 180;
  const north = (next.lat - previous.lat) * radians;
  const east = (next.lon - previous.lon) * radians;
  const a = Math.sin(north / 2) ** 2 + Math.cos(previous.lat * radians) * Math.cos(next.lat * radians) * Math.sin(east / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) >= 500;
}
