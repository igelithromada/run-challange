"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink, Footprints, Map, Mountain, Route, Download, ChevronDown, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import RouteMap from "../components/RouteMap";
import { routeGroups } from "../lib/routes";

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
            const Icon = group.id === "obora" ? Mountain : Footprints;
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

                        {route.gpxUrl ? (
                          <RouteMap gpxUrl={route.gpxUrl} mapUrl={route.mapUrl} name={route.name} laps={route.laps} />
                        ) : (
                          <div className="route-map-unavailable">
                            <MapPinned size={18} />
                            <span>Interaktivní mapa není k dispozici – pořadatel pro tuto trasu nezveřejňuje GPX.</span>
                          </div>
                        )}

                        <div className="route-card-actions">
                          <a className="route-primary-action" href={route.mapUrl} target="_blank" rel="noopener noreferrer">
                            <Map size={18} /> Mapy.com
                            <ExternalLink size={15} />
                          </a>
                          {route.gpxUrl && (
                            <a className="route-secondary-action" href={route.gpxUrl} target="_blank" rel="noopener noreferrer">
                              <Download size={17} /> Stáhnout GPX
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
            <p>GPX se otevře v Mapy.com jako trasa. Mapy.com může při importu vyžadovat přihlášení.</p>
          </div>
        </section>

        <p className="routes-disclaimer">
          Trasy a jejich průběh může pořadatel podle aktuálních podmínek upravit. Aplikace zobrazuje data z veřejných stránek SKS Dolní Lhota.
        </p>
      </main>
    </>
  );
}
