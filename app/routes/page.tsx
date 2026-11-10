"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink, Footprints, Map, Mountain, Route, Download, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

type RouteItem = {
  name: string;
  distance: string;
  activity: "běh" | "chůze";
  description: string;
  mapUrl: string;
  gpxUrl?: string;
  badge?: string;
};

const routeGroups = [
  {
    id: "skrpal",
    title: "Dolnolhotský Škrpál",
    subtitle: "Pochod za zdravím pro celou rodinu",
    icon: Footprints,
    sourceUrl: "https://www.sksdl.cz/skrpal/trasy/",
    routes: [
      {
        name: "Trasa A",
        distance: "~6 km",
        activity: "chůze" as const,
        description: "Rodinná trasa přes Čavisov, les a Vlčí kout. Počítej s náročnějším terénem a delší vycházkou.",
        mapUrl: "https://mapy.com/s/cekuhukuhe",
        gpxUrl: "https://sarops.info/skrpal/2026/A.gpx",
        badge: "Rodinná",
      },
      {
        name: "Trasa B",
        distance: "~15 km",
        activity: "chůze" as const,
        description: "Středně dlouhá trasa přes lesy, rybníčky, Zbyslavice, Sezinu a Čavisov.",
        mapUrl: "https://mapy.com/s/fukavalela",
        gpxUrl: "https://sarops.info/skrpal/2026/B.gpx",
        badge: "Střední",
      },
      {
        name: "Trasa C",
        distance: "~31 km",
        activity: "chůze" as const,
        description: "Nejdelší trasa pro zkušenější chodce. Vede přes Bítov, Kyjovice, Zátiší, Horník a Čavisov.",
        mapUrl: "https://mapy.com/s/bugonekeku",
        gpxUrl: "https://sarops.info/skrpal/2026/C.gpx",
        badge: "Výzva",
      },
    ],
  },
  {
    id: "obora",
    title: "Obora Trail Run",
    subtitle: "Běžecké trasy v lese Obora u Dolní Lhoty",
    icon: Mountain,
    sourceUrl: "https://www.sksdl.cz/obora-trail-run/trasy-r4f/",
    routes: [
      {
        name: "Obora 100 m",
        distance: "100 m",
        activity: "běh" as const,
        description: "Krátká dětská běžecká trasa.",
        mapUrl: "https://mapy.com/s/cavozunuja",
        badge: "Děti",
      },
      {
        name: "Obora 200 m",
        distance: "200 m",
        activity: "běh" as const,
        description: "Krátký dětský okruh v lese Obora.",
        mapUrl: "https://mapy.com/s/gesugecamu",
        badge: "Děti",
      },
      {
        name: "Obora 400 m",
        distance: "400 m",
        activity: "běh" as const,
        description: "Dětská běžecká trasa využívající značení okruhu Obora.",
        mapUrl: "https://mapy.com/s/kucagusenu",
        badge: "Děti",
      },
      {
        name: "Obora 600 m",
        distance: "600 m",
        activity: "běh" as const,
        description: "Delší dětský okruh v lese Obora.",
        mapUrl: "https://mapy.com/s/jadepogecu",
        badge: "Děti",
      },
      {
        name: "Obora 900 m",
        distance: "900 m",
        activity: "běh" as const,
        description: "Krátký běžecký okruh v Obora, vhodný i pro samostatný trénink.",
        mapUrl: "https://mapy.com/s/fasolozese",
        badge: "Okruh",
      },
      {
        name: "Obora 5 km",
        distance: "5 km",
        activity: "běh" as const,
        description: "Běžecký okruh v mírném lesním terénu. Jeden okruh závodní trasy.",
        mapUrl: "https://mapy.com/s/janevojeku",
        gpxUrl: "https://sarops.info/oboratrailrun/2026/5km.gpx",
        badge: "Běh",
      },
      {
        name: "Obora 10 km",
        distance: "10 km",
        activity: "běh" as const,
        description: "Dva okruhy stejné trasy jako u varianty 5 km.",
        mapUrl: "https://mapy.com/s/janevojeku",
        gpxUrl: "https://sarops.info/oboratrailrun/2026/5km.gpx",
        badge: "Výzva",
      },
    ],
  },
];

export default function RoutesPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [filter, setFilter] = useState<"vše" | "běh" | "chůze">("vše");
  const [openGroup, setOpenGroup] = useState<string | null>("skrpal");

  const visibleGroups = useMemo(
    () =>
      routeGroups
        .map(group => ({
          ...group,
          routes: group.routes.filter(route => filter === "vše" || route.activity === filter),
        }))
        .filter(group => group.routes.length > 0),
    [filter]
  );

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      const { signOut } = await import("firebase/auth");
      const { auth } = await import("../lib/firebase");
      await signOut(auth);
      router.push("/login");
      return;
    }
    if (item === "home") router.push("/");
    else if (item === "myrun") router.push("/myruns");
    else if (item === "teams") router.push("/teams");
    else if (item === "progress") router.push("/progress");
    else if (item === "trainer") router.push("/trainer");
    else if (item === "statistics") router.push("/statistics");
    else if (item === "participants") router.push("/participants");
    else if (item === "weather") router.push("/weather");
    else if (item === "settings") router.push("/settings");
    else if (item === "routes") router.push("/routes");
    else router.push("/");
  };

  return (
    <>
      <Navbar title="Doporučené trasy" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <main className="container routes-page">
        <header className="routes-header">
          <span className="routes-eyebrow">POHYB V OKOLÍ DOLNÍ LHOTY</span>
          <h1>Doporučené trasy</h1>
          <p>Trasy z místních sportovních akcí převedené do vzhledu naší aplikace.</p>
        </header>

        <div className="routes-filter" role="tablist" aria-label="Filtr tras">
          {[
            ["vše", "Vše"],
            ["běh", "Běh"],
            ["chůze", "Chůze"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value as "vše" | "běh" | "chůze")}
            >
              {value === "běh" ? <Route size={18} /> : value === "chůze" ? <Footprints size={18} /> : <Map size={18} />}
              {label}
            </button>
          ))}
        </div>

        <div className="routes-groups">
          {visibleGroups.map(group => {
            const Icon = group.icon;
            const isOpen = openGroup === group.id;
            return (
              <section className="routes-group tile" key={group.id}>
                <button
                  type="button"
                  className="routes-group-heading"
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                >
                  <span className="routes-group-icon"><Icon size={25} /></span>
                  <span className="routes-group-copy">
                    <strong>{group.title}</strong>
                    <small>{group.subtitle}</small>
                  </span>
                  <ChevronDown className={isOpen ? "routes-chevron open" : "routes-chevron"} size={22} />
                </button>

                {isOpen && (
                  <div className="routes-list">
                    {group.routes.map(route => (
                      <article className="route-card" key={route.name}>
                        <div className="route-card-main">
                          <div className="route-card-icon">
                            {route.activity === "běh" ? <Route size={23} /> : <Footprints size={23} />}
                          </div>
                          <div className="route-card-info">
                            <div className="route-card-title">
                              <h2>{route.name}</h2>
                              {route.badge && <span>{route.badge}</span>}
                            </div>
                            <div className="route-card-meta">
                              <strong>{route.distance}</strong>
                              <span>{route.activity === "běh" ? "Běh" : "Chůze"}</span>
                            </div>
                            <p>{route.description}</p>
                          </div>
                        </div>
                        <div className="route-card-actions">
                          <a className="route-primary-action" href={route.mapUrl} target="_blank" rel="noopener noreferrer">
                            <Map size={18} /> Zobrazit trasu
                            <ExternalLink size={15} />
                          </a>
                          {route.gpxUrl && (
                            <a className="route-secondary-action" href={route.gpxUrl} target="_blank" rel="noopener noreferrer">
                              <Download size={17} /> GPX
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <a className="routes-source" href={group.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Zdroj a podrobnosti na SKS Dolní Lhota <ExternalLink size={13} />
                </a>
              </section>
            );
          })}
        </div>

        <section className="routes-note tile">
          <Map size={21} />
          <div>
            <strong>Trasu můžeš otevřít přímo v Mapy.com</strong>
            <p>Na telefonu se odkaz může otevřít v aplikaci Mapy.com. GPX soubor lze použít i v jiné navigaci nebo sportovní aplikaci, která GPX podporuje.</p>
          </div>
        </section>

        <p className="routes-disclaimer">
          Trasy a jejich průběh může pořadatel podle aktuálních podmínek upravit. Aplikace proto odkazuje na aktuální mapové podklady a zdroj SKS Dolní Lhota.
        </p>
      </main>
    </>
  );
}
