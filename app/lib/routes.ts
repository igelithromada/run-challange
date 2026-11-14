export type RouteItem = {
  id?: string;
  name: string;
  distance: string;
  activity: "běh" | "chůze" | "běh i chůze";
  description: string;
  mapUrl: string;
  gpxUrl?: string;
  laps?: number;
};

export type RouteGroup = {
  id: string;
  title: string;
  subtitle: string;
  sourceUrl: string;
  routes: RouteItem[];
};

// Trasy nejsou součástí zdrojového kódu. Všechny doporučené trasy
// se nahrávají výhradně přes administraci do Firestore.
