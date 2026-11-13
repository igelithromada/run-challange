export type RouteItem = {
  name: string;
  distance: string;
  activity: "běh" | "chůze" | "běh i chůze";
  description: string;
  mapUrl: string;
  gpxUrl?: string;
  badge?: string;
  laps?: number;
};

export type RouteGroup = {
  id: string;
  title: string;
  subtitle: string;
  sourceUrl: string;
  routes: RouteItem[];
};

export const routeGroups: RouteGroup[] = [
  {
    id: "skrpal",
    title: "Dolnolhotský Škrpál",
    subtitle: "Pochod za zdravím pro celou rodinu",
    sourceUrl: "https://www.sksdl.cz/skrpal/trasy/",
    routes: [
      {
        name: "Trasa A",
        distance: "~7 km",
        activity: "chůze",
        description: "Rodinná trasa z ročníku 2025. Vedla přes okolí Dolní Lhoty, Čavisova a lesních cest.",
        mapUrl: "https://mapy.com/s/movedoguko",
        gpxUrl: "https://sarops.info/skrpal/2025/7.gpx",
        badge: "Rodinná",
      },
      {
        name: "Trasa B",
        distance: "~17 km",
        activity: "chůze",
        description: "Středně dlouhá trasa z ročníku 2025 pro vytrvalejší chodce a výletáře.",
        mapUrl: "https://mapy.com/s/jemufuhovo",
        gpxUrl: "https://sarops.info/skrpal/2025/17.gpx",
        badge: "Střední",
      },
      {
        name: "Trasa C",
        distance: "~31 km",
        activity: "chůze",
        description: "Nejdelší trasa z ročníku 2025 pro zkušenější chodce.",
        mapUrl: "https://mapy.com/s/bazuhovovu",
        gpxUrl: "https://sarops.info/skrpal/2025/31.gpx",
        badge: "Výzva",
      },
    ],
  },
  {
    id: "obora",
    title: "Obora Trail Run",
    subtitle: "Běžecké trasy v lese Obora u Dolní Lhoty",
    sourceUrl: "https://www.sksdl.cz/obora-trail-run/trasy-r4f/",
    routes: [
      { name: "Obora 100 m", distance: "100 m", activity: "běh", description: "Krátká dětská běžecká trasa.", mapUrl: "https://mapy.com/s/cavozunuja", badge: "Děti" },
      { name: "Obora 200 m", distance: "200 m", activity: "běh", description: "Krátký dětský okruh v lese Obora.", mapUrl: "https://mapy.com/s/gesugecamu", badge: "Děti" },
      { name: "Obora 400 m", distance: "400 m", activity: "běh", description: "Dětská běžecká trasa využívající značení okruhu Obora.", mapUrl: "https://mapy.com/s/kucagusenu", badge: "Děti" },
      { name: "Obora 600 m", distance: "600 m", activity: "běh", description: "Delší dětský okruh v lese Obora.", mapUrl: "https://mapy.com/s/jadepogecu", badge: "Děti" },
      { name: "Obora 900 m", distance: "900 m", activity: "běh", description: "Krátký běžecký okruh v Oboře. Pořadatel u této trasy GPX odkaz nezveřejňuje.", mapUrl: "https://mapy.com/s/fasolozese", badge: "Okruh" },
      { name: "Obora 5 km", distance: "5 km", activity: "běh", description: "Jeden okruh závodní trasy Obora Trail Run 2026.", mapUrl: "https://mapy.com/s/janevojeku", gpxUrl: "https://sarops.info/oboratrailrun/2026/5km.gpx", badge: "Běh" },
      { name: "Obora 10 km", distance: "10 km", activity: "běh", description: "Dva okruhy stejné trasy jako varianta 5 km.", mapUrl: "https://mapy.com/s/janevojeku", gpxUrl: "https://sarops.info/oboratrailrun/2026/5km.gpx", badge: "Výzva", laps: 2 },
    ],
  },
];
