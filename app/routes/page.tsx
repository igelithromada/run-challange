"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink, Map, Download, MapPinned, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import RouteMap from "../components/RouteMap";
import { routeGroups, type RouteGroup, type RouteItem } from "../lib/routes";
import { getRecommendedRouteGroups } from "../lib/recommendedRoutes";
import { ActivityTypeIcon } from "../components/ActivityTypeSelector";
import type { ActivityType } from "../types";

export default function RoutesPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [filter, setFilter] = useState<"vše" | "běh" | "chůze">("vše");
  const [allGroups, setAllGroups] = useState<RouteGroup[]>(routeGroups);
  const [selectedRoute, setSelectedRoute] = useState<{ route: RouteItem; groupTitle: string } | null>(null);
  const [mapStyle, setMapStyle] = useState<"standard" | "minimal">("minimal");

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

        <div className="routes-filter" role="group" aria-label="Filtr tras">
          <button
            type="button"
            className={`activity-quick-filter-button${filter === "vše" ? " active" : ""}`}
            onClick={() => setFilter("vše")}
          >
            <Map size={20} aria-hidden="true" /> Vše
          </button>
          <button
            type="button"
            className={`activity-quick-filter-button${filter === "běh" ? " active" : ""}`}
            onClick={() => setFilter("běh")}
          >
            <ActivityTypeIcon type={"běh" as ActivityType} size={20} /> Běh
          </button>
          <button
            type="button"
            className={`activity-quick-filter-button${filter === "chůze" ? " active" : ""}`}
            onClick={() => setFilter("chůze")}
          >
            <ActivityTypeIcon type={"chůze" as ActivityType} size={20} /> Chůze
          </button>
        </div>

        <div className="routes-view-toggle" role="group" aria-label="Styl mapy">
          <button type="button" className={mapStyle === "minimal" ? "active" : ""} onClick={() => setMapStyle("minimal")}>
            <Sparkles size={18} /> Naše
          </button>
          <button type="button" className={mapStyle === "standard" ? "active" : ""} onClick={() => setMapStyle("standard")}>
            <Map size={18} /> Mapa
          </button>
        </div>

        <style>{`
          .route-map-preview-button{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;border-radius:16px;overflow:hidden}
          .route-card-main-button{display:flex;width:100%;box-sizing:border-box;cursor:pointer;border:0;text-align:left}
          .route-card-main-button:hover{background:rgba(255,255,255,.04)}
          .routes-view-toggle{display:flex;gap:.45rem;margin:-.45rem 0 1rem}
          .routes-view-toggle button{display:inline-flex;align-items:center;gap:.4rem;min-height:40px;padding:.55rem .8rem;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.07);color:inherit;font:inherit;font-weight:750;cursor:pointer}
          .routes-view-toggle button.active{background:rgba(255,255,255,.24);border-color:rgba(255,255,255,.42)}
          .route-map-preview-button:focus-visible{outline:2px solid rgba(255,255,255,.9);outline-offset:3px}
          .route-detail-backdrop{position:fixed;inset:0;z-index:5000;display:flex;align-items:stretch;justify-content:center;padding:0;background:rgba(8,16,22,.72);backdrop-filter:blur(10px)}
          .route-detail-modal{width:min(900px,100%);height:100%;overflow:auto;box-sizing:border-box;padding:1rem; background:linear-gradient(180deg,rgba(40,62,73,.98),rgba(28,44,54,.99));color:white}
          .route-detail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.8rem}
          .route-detail-header span{font-size:.72rem;opacity:.7}
          .route-detail-header h2{margin:.15rem 0;font-size:1.45rem}
          .route-detail-header p{margin:0;opacity:.75}
          .route-detail-header>button{flex:0 0 44px;width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.12);color:white;font-size:1.8rem;line-height:1;cursor:pointer}
          .route-detail-description{margin:.8rem 0;line-height:1.5;opacity:.86}
          .route-detail-map .route-map-shell{height:calc(100vh - 270px);min-height:360px;margin-top:.8rem;border-radius:18px}
          .route-detail-actions{margin-top:.8rem;padding-bottom:.4rem}
          .route-detail-actions a{min-height:48px}
          @media(max-width:520px){.route-detail-modal{padding:.75rem}.route-detail-map .route-map-shell{height:calc(100vh - 250px);min-height:300px}.route-detail-header h2{font-size:1.25rem}}
        `}</style>
        <div className="routes-groups">
          {visibleRoutes.map(({ route, groupTitle }) => (
            <article className="route-card tile" key={route.name + groupTitle}>
              <button
                type="button"
                className="route-card-main route-card-main-button"
                onClick={() => setSelectedRoute({ route, groupTitle })}
                aria-label={`Otevřít podrobnosti trasy ${route.name}`}
              >
                <div className="route-card-icon">
                  <ActivityTypeIcon type={route.activity} size={23} />
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
              </button>
              <button
                type="button"
                className="route-map-preview-button"
                onClick={() => setSelectedRoute({ route, groupTitle })}
                aria-label={`Otevřít detail trasy ${route.name}`}
              >
                {route.gpxUrl ? (
                  <RouteMap gpxUrl={route.gpxUrl} mapUrl={route.mapUrl} name={route.name} laps={route.laps} interactive={false} mapStyle={mapStyle} showInfo={false} />
                ) : (
                  <div className="route-map-unavailable">
                    <MapPinned size={18} />
                    <span>Náhled mapy není k dispozici.</span>
                  </div>
                )}
              </button>
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
                  <RouteMap gpxUrl={selectedRoute.route.gpxUrl} mapUrl={selectedRoute.route.mapUrl} name={selectedRoute.route.name} laps={selectedRoute.route.laps} interactive mapStyle={mapStyle} showInfo={false} />
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
