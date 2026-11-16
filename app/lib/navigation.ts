import {
  CloudSun,
  Dumbbell,
  Footprints,
  ListOrdered,
  Map,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";

export type NavigationItem = {
  id: string;
  label: string;
  route: string;
  group: "activity" | "community" | "tools" | "system";
  adminOnly?: boolean;
  Icon: typeof Footprints;
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: "myrun", label: "Moje aktivity", route: "/myruns", group: "activity", Icon: Footprints },
  { id: "progress", label: "Můj pokrok", route: "/progress", group: "activity", Icon: TrendingUp },
  { id: "trainer", label: "Osobní trenér", route: "/trainer", group: "activity", Icon: Dumbbell },

  { id: "teams", label: "Týmy", route: "/teams", group: "community", Icon: Users },
  { id: "challenges", label: "Výzvy", route: "/challenges", group: "community", Icon: Trophy },
  { id: "participants", label: "Účastníci", route: "/participants", group: "community", Icon: ListOrdered },

  { id: "statistics", label: "Výsledky", route: "/statistics", group: "tools", Icon: Trophy },
  { id: "weather", label: "Počasí pro běh", route: "/weather", group: "tools", Icon: CloudSun },
  { id: "routes", label: "Doporučené trasy", route: "/routes", group: "tools", Icon: Map },

  { id: "settings", label: "Nastavení", route: "/settings", group: "system", Icon: SlidersHorizontal },
  { id: "admin", label: "Administrace", route: "/admin", group: "system", adminOnly: true, Icon: ShieldCheck },
];

export const NAVIGATION_GROUPS: Array<{ id: NavigationItem["group"]; label: string }> = [
  { id: "activity", label: "Moje aktivita" },
  { id: "community", label: "Komunita" },
  { id: "tools", label: "Nástroje" },
  { id: "system", label: "Aplikace" },
];
