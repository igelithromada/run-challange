"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink, Footprints, Map, Mountain, Route, Download, ChevronDown, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import RouteMap from "../components/RouteMap";
import { routeGroups, type RouteGroup, type RouteItem } from "../lib/routes";
import { getRecommendedRouteGroups } from "../lib/recommendedRoutes";

export default function RoutesPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [filter, setFilter] = useState<"vše" | "běh" | "chůze">("vše");
  const [allGroups, setAllGroups] = useState<RouteGroup[]>(routeGroups);
  const [selectedRoute, setSelectedRoute] = useState<{ route: RouteItem; groupTitle: string } | null>(null);

  React.useEffect(() => {
    let active = true;
    void getRecommendedRouteGroups().then(groups => {
      if (!active || !groups.length) return;
      setAllGroups(prev => [...prev, ...groups]);
    });
    return () => { active = false; };
  }, []);

  const visibleRoutes = useMemo(
    () => allGroups.flatMap(group =>
      group.routes
        .filter(route => filter === "vše" || route.activity === filter)
        .map(route => ({ route, groupTitle: group.title }))
    ),
    [allGroups, filter]
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
          <h1>Doporučené trasy</h1>
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
          {visibleRoutes.map(({ route, groupTitle }) => (
            <article className="route-card tile" key={route.name + groupTitle}>
              <button
                type="button"
                className="route-map-preview-button"
                onClick={() => setSelectedRoute({ route, groupTitle })}
                aria-label={`Otevřít podrobnosti trasy ${route.name}`}
              >
                {route.gpxUrl ? (
                  <RouteMap gpxUrl={route.gpxUrl} mapUrl={route.mapUrl} name={route.name} laps={route.laps} />
                ) : (
                  <div className="route-map-unavailable">
                    <MapPinned size={18} />
                    <span>Náhled mapy není k dispozici.</span>
                  </div>
                )}
              </button>
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
                  <p><strong>{groupTitle}</strong> · {route.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {selectedRoute && (
          <div className="route-detail-backdrop" role="presentation" onClick={() => setSelectedRoute(null)}>
            <section className="route-detail-modal" role="dialog" aria-modal="true" aria-label={selectedRoute.route.name} onClick={e => e.stopPropagation()}>
              <div className="route-detail-header">
                <div>
                  <span>{selectedRoute.groupTitle}</span>
                  <h2>{selectedRoute.route.name}</h2>
                  <p>{selectedRoute.route.distance} · {selectedRoute.route.activity === "běh" ? "Běh" : "Chůze"}{selectedRoute.route.badge ? ` · ${selectedRoute.route.badge}` : ""}</p>
                </div>
                <button type="button" onClick={() => setSelectedRoute(null)} aria-label="Zavřít podrobnosti">×</button>
              </div>
              <p className="route-detail-description">{selectedRoute.route.description}</p>
              {selectedRoute.route.gpxUrl && (
                <div className="route-detail-map">
                  <RouteMap gpxUrl={selectedRoute.route.gpxUrl} mapUrl={selectedRoute.route.mapUrl} name={selectedRoute.route.name} laps={selectedRoute.route.laps} />
                </div>
              )}
              <div className="route-card-actions route-detail-actions">
                <a className="route-primary-action" href={selectedRoute.route.mapUrl} target="_blank" rel="noopener noreferrer">
                  <Map size={18} /> Otevřít v Mapy.com <ExternalLink size={15} />
                </a>
                {selectedRoute.route.gpxUrl && (
                  <a className="route-secondary-action" href={selectedRoute.route.gpxUrl} target="_blank" rel="noopener noreferrer">
                    <Download size={17} /> Stáhnout GPX
                  </a>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
