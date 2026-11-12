import type { RouteGroup, RouteItem } from "./routes";

export async function getRecommendedRouteGroups(): Promise<RouteGroup[]> {
  try {
    const response = await fetch("/api/routes/recommended", { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    const items = Array.isArray(data.routes) ? data.routes : [];
    const groups = new Map<string, RouteGroup>();

    for (const item of items) {
      if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.gpxUrl) continue;
      const groupId = typeof item.groupId === "string" && item.groupId ? item.groupId : "moje-trasy";
      const group = groups.get(groupId) ?? {
        id: groupId,
        title: typeof item.groupTitle === "string" && item.groupTitle ? item.groupTitle : "Moje doporučené trasy",
        subtitle: typeof item.groupSubtitle === "string" ? item.groupSubtitle : "",
        sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : "",
        routes: [] as RouteItem[],
      };
      const route: RouteItem = {
        name: item.name,
        distance: typeof item.distance === "string" && item.distance ? item.distance : "GPX",
        activity: item.activity === "běh" ? "běh" : "chůze",
        description: typeof item.description === "string" ? item.description : "",
        mapUrl: typeof item.mapUrl === "string" ? item.mapUrl : `https://mapy.com/fnc/v1/gpx?url=${encodeURIComponent(item.gpxUrl)}`,
        gpxUrl: item.gpxUrl,
        badge: typeof item.badge === "string" ? item.badge : undefined,
      };
      group.routes.push(route);
      groups.set(groupId, group);
    }
    return Array.from(groups.values());
  } catch {
    return [];
  }
}
