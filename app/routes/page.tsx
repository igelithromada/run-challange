"use client";

import React, { useState } from "react";
import { ExternalLink, Map, Download, MapPinned, FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import RouteMap from "../components/RouteMap";
import { routeGroups, type RouteGroup, type RouteItem } from "../lib/routes";
import { getRecommendedRouteGroups } from "../lib/recommendedRoutes";
import { auth } from "../lib/firebase";
import useAdminGuard from "../lib/useAdminGuard";
import { showAppToast } from "../components/AppToast";

export default function RoutesPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [allGroups, setAllGroups] = useState<RouteGroup[]>(routeGroups);
  const [selectedRoute, setSelectedRoute] = useState<{ route: RouteItem; groupTitle: string } | null>(null);
  const [routeFile, setRouteFile] = useState<File | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeDescription, setRouteDescription] = useState("");
  const [routeBadge, setRouteBadge] = useState("");
  const [routeSourceUrl, setRouteSourceUrl] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [adminRoutes, setAdminRoutes] = useState<Array<{id:string;name:string;activity:string;description?:string;badge?:string;sourceUrl?:string;gpxUrl?:string;isStatic?:boolean;disabled?:boolean;deleted?:boolean}>>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeSort, setRouteSort] = useState<"shortest" | "longest">("shortest");
  const adminAccess = useAdminGuard();

  React.useEffect(() => {
    let active = true;
    void getRecommendedRouteGroups().then(groups => {
      if (!active || !groups.length) return;
      setAllGroups(groups);
    });
    return () => { active = false; };
  }, []);

  const loadAdminRoutes = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/routes", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (response.ok) setAdminRoutes(Array.isArray(result.routes) ? result.routes : []);
    } catch (e) {
      showAppToast(e instanceof Error ? e.message : "Trasy se nepodařilo načíst.", "error");
    }
  };

  React.useEffect(() => {
    if (adminAccess === "allowed") void loadAdminRoutes();
  }, [adminAccess]);

  const resetRouteForm = () => {
    setEditingRouteId(null); setShowRouteForm(false); setRouteFile(null); setRouteName("");
    setRouteDescription(""); setRouteBadge(""); setRouteSourceUrl("");
    const input = document.getElementById("routes-admin-gpx") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const startEditRoute = (route: {id:string;name:string;activity:string;description?:string;badge?:string;sourceUrl?:string}) => {
    setEditingRouteId(route.id);
    setShowRouteForm(true);
    setRouteName(route.name || "");
    setRouteDescription(route.description || "");
    setRouteBadge(route.badge || "");
    setRouteSourceUrl(route.sourceUrl || "");
    setRouteFile(null);
    const input = document.getElementById("routes-admin-gpx") as HTMLInputElement | null;
    if (input) input.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRoute = async () => {
    if (!routeName.trim()) { showAppToast("Zadej název trasy.", "error"); return; }
    if (!editingRouteId && !routeFile) { showAppToast("Vyber GPX soubor.", "error"); return; }
    setRouteBusy(true);
    const wasEditing = Boolean(editingRouteId);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const form = new FormData();
      form.append("name", routeName);
      form.append("description", routeDescription); form.append("badge", routeBadge); form.append("sourceUrl", routeSourceUrl);
      if (routeFile) form.append("file", routeFile);
      let response: Response;
      if (editingRouteId) {
        form.append("id", editingRouteId);
        response = await fetch("/api/admin/routes", { method:"PUT", headers:{Authorization:`Bearer ${token}`}, body:form });
      } else {
        form.append("groupId","vlastni-trasy"); form.append("groupTitle","Vlastní doporučené trasy"); form.append("groupSubtitle","");
        response = await fetch("/api/admin/routes", { method:"POST", headers:{Authorization:`Bearer ${token}`}, body:form });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Trasu se nepodařilo uložit.");
      resetRouteForm();
      await loadAdminRoutes();
      const refreshedGroups = await getRecommendedRouteGroups();
      if (refreshedGroups.length) setAllGroups(refreshedGroups);
      showAppToast(wasEditing ? "Trasa byla upravena." : "Trasa byla přidána.", "success");
    } catch (e) {
      showAppToast(e instanceof Error ? e.message : "Trasu se nepodařilo uložit.", "error");
    } finally { setRouteBusy(false); }
  };

  const changeRouteState = async (id: string, name: string, action: "activate" | "deactivate" | "delete") => {
    const message =
      action === "deactivate"
        ? `Deaktivovat trasu „${name}“? Přestane se zobrazovat uživatelům, ale později ji můžeš znovu aktivovat.`
        : action === "delete"
          ? `Opravdu trvale smazat trasu „${name}“? Tuto akci už nepůjde vrátit.`
          : `Znovu aktivovat trasu „${name}“?`;
    if (!window.confirm(message)) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nejsi přihlášen.");
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/admin/routes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Stav trasy se nepodařilo změnit.");

      if (action === "delete") {
        setAdminRoutes(prev => prev.filter(item => item.id !== id));
        if (editingRouteId === id) resetRouteForm();
      } else {
        setAdminRoutes(prev => prev.map(item => item.id === id ? { ...item, disabled: action === "deactivate" } : item));
      }

      const refreshedGroups = await getRecommendedRouteGroups();
      setAllGroups(refreshedGroups);
      showAppToast(
        action === "delete" ? "Trasa byla trvale smazána." :
        action === "deactivate" ? "Trasa byla deaktivována." : "Trasa byla znovu aktivována.",
        "success"
      );
    } catch (e) {
      showAppToast(e instanceof Error ? e.message : "Stav trasy se nepodařilo změnit.", "error");
    }
  };

  const visibleRoutes = allGroups
    .flatMap(group => group.routes.map(route => ({ route, groupTitle: group.title })))
    .sort((a, b) => {
      const parseDistanceKm = (value: string) => {
        const normalized = value.replace(",", ".").replace("~", "").trim().toLowerCase();
        const match = normalized.match(/([0-9]+(?:\\.[0-9]+)?)\\s*(km|m)?/);
        if (!match) return Number.POSITIVE_INFINITY;
        const amount = Number(match[1]);
        return match[2] === "m" ? amount / 1000 : amount;
      };
      const diff = parseDistanceKm(a.route.distance) - parseDistanceKm(b.route.distance);
      if (diff !== 0) return routeSort === "shortest" ? diff : -diff;
      return a.route.name.localeCompare(b.route.name, "cs");
    });

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

        {adminAccess === "allowed" && showRouteForm && (
          <section className="tile routes-admin-form-panel">
            <div className="admin-section-heading">
              <FileUp size={21}/>
              <div>
                <h2>{editingRouteId ? "Upravit trasu" : "Přidat trasu"}</h2>
                <span>{editingRouteId ? "Uprav údaje trasy nebo případně nahraď GPX soubor." : "Přidej novou doporučenou trasu pomocí GPX souboru."}</span>
              </div>
            </div>
            <div className="admin-route-form">
              <input id="routes-admin-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={e => setRouteFile(e.target.files?.[0] || null)} />
              <input type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Název trasy" />
              <input type="text" value={routeBadge} onChange={e => setRouteBadge(e.target.value)} placeholder="Štítek, např. Výzva" />
              <textarea value={routeDescription} onChange={e => setRouteDescription(e.target.value)} placeholder="Popis trasy" rows={3} />
              <input type="url" value={routeSourceUrl} onChange={e => setRouteSourceUrl(e.target.value)} placeholder="Volitelný odkaz na zdroj" />
              <div className="admin-route-form-actions">
                <button type="button" className="admin-action-button" onClick={() => void saveRoute()} disabled={routeBusy}>
                  <Upload size={18}/>{routeBusy ? "Ukládám…" : editingRouteId ? "Uložit změny" : "Přidat trasu"}
                </button>
                <button type="button" className="admin-action-button" onClick={resetRouteForm} disabled={routeBusy}>Zrušit</button>
              </div>
            </div>
          </section>
        )}

        <style>{`
          .routes-sort-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:.45rem;margin:0 0 1rem;flex-wrap:wrap}
          .routes-sort-toolbar>span{opacity:.7;font-size:.9rem;margin-right:.15rem}
          .routes-sort-toolbar button{min-height:40px;padding:.45rem .8rem;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.08);color:inherit;font-weight:700;cursor:pointer}
          .routes-sort-toolbar button.active{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.38)}
          .routes-admin-toolbar{display:flex;justify-content:flex-end;margin-bottom:1rem}
          .routes-admin-form-panel{margin-bottom:1rem}
          .route-admin-actions{display:flex;gap:.5rem;margin-top:.8rem}
          .route-admin-actions button{min-width:0;flex:1}
          .routes-disabled-panel{margin-bottom:1rem}
          .routes-disabled-list{display:flex;flex-direction:column;gap:.6rem;margin-top:1rem}
          .routes-disabled-row{display:flex;align-items:center;justify-content:space-between;gap:.7rem;padding:.75rem;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(0,0,0,.16)}
          .routes-disabled-row>div:first-child{min-width:0}
          .routes-disabled-row strong{display:block;overflow-wrap:anywhere}
          .routes-disabled-row small{display:block;margin-top:.15rem;opacity:.65}
          .routes-disabled-actions{display:flex;gap:.4rem;flex:0 0 auto}
          .routes-disabled-actions button{min-height:40px;padding:.45rem .65rem;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:rgba(255,255,255,.1);color:white;font-weight:700;cursor:pointer}
          .routes-disabled-actions .danger{background:rgba(150,60,70,.28);border-color:rgba(255,130,140,.25)}
          .route-admin-actions button{flex:1;min-height:44px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.1);color:white;font-weight:700;cursor:pointer}
          .route-admin-actions .danger{background:rgba(150,60,70,.28);border-color:rgba(255,130,140,.25)}
          .route-admin-source{margin:.45rem 0 0;opacity:.65;font-size:.78rem;text-align:center}
          .route-admin-add{width:100%;min-height:50px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.13);color:white;font-size:1rem;font-weight:800;cursor:pointer}
          .route-map-preview-button{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;border-radius:16px;overflow:hidden}
          .route-card-main-button{display:flex;width:100%;box-sizing:border-box;cursor:pointer;border:0;background:transparent;color:inherit;padding:0;text-align:left;font:inherit}
          .route-card-main-button:hover{background:rgba(255,255,255,.04)}
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
          @media(max-width:620px){.routes-disabled-row{align-items:stretch;flex-direction:column}.routes-disabled-actions{width:100%}.routes-disabled-actions button{flex:1;min-width:0}}\n          @media(max-width:520px){.route-detail-modal{padding:.75rem}.route-detail-map .route-map-shell{height:calc(100vh - 250px);min-height:300px}.route-detail-header h2{font-size:1.25rem}}
        `}</style>
        <div className="routes-sort-toolbar" aria-label="Řazení tras">
          <span>Řazení:</span>
          <button type="button" className={routeSort === "shortest" ? "active" : ""} onClick={() => setRouteSort("shortest")}>Nejkratší</button>
          <button type="button" className={routeSort === "longest" ? "active" : ""} onClick={() => setRouteSort("longest")}>Nejdelší</button>
        </div>

        {adminAccess === "allowed" && !showRouteForm && (
          <div className="routes-admin-toolbar">
            <button type="button" className="route-admin-add" onClick={() => { resetRouteForm(); setShowRouteForm(true); setRouteName(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Upload size={18}/> Přidat trasu
            </button>
          </div>
        )}

        {adminAccess === "allowed" && adminRoutes.some(route => route.disabled) && (
          <section className="tile routes-disabled-panel">
            <div className="admin-section-heading">
              <MapPinned size={21}/>
              <div>
                <h2>Deaktivované trasy</h2>
                <span>Tyto trasy jsou skryté uživatelům, ale můžeš je kdykoli znovu aktivovat.</span>
              </div>
            </div>
            <div className="routes-disabled-list">
              {adminRoutes.filter(route => route.disabled).map(route => (
                <div className="routes-disabled-row" key={route.id}>
                  <div>
                    <strong>{route.name}</strong>
                    <small>{route.activity}</small>
                  </div>
                  <div className="routes-disabled-actions">
                    <button type="button" onClick={() => startEditRoute(route)}>Upravit</button>
                    <button type="button" onClick={() => void changeRouteState(route.id, route.name, "activate")}>Aktivovat</button>
                    <button type="button" className="danger" onClick={() => void changeRouteState(route.id, route.name, "delete")}>Smazat</button>
                  </div>
                  <small>{route.isStatic ? "Mapa je součástí kódu aplikace." : "Mapa je nahraná v úložišti aplikace."}</small>
                </div>
              ))}
            </div>
          </section>
        )}

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
                  <MapPinned size={23} />
                </div>
                <div className="route-card-info">
                  <div className="route-card-title">
                    <h2>{route.name}</h2>
                    {route.badge && <span>{route.badge}</span>}
                  </div>
                  <div className="route-card-meta">
                    <strong>{route.distance}</strong>
                    <span>Běh i chůze</span>
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
                  <RouteMap gpxUrl={route.gpxUrl} mapUrl={route.mapUrl} name={route.name} laps={route.laps} interactive={false} mapStyle="standard" />
                ) : (
                  <div className="route-map-unavailable">
                    <MapPinned size={18} />
                    <span>Náhled mapy není k dispozici.</span>
                  </div>
                )}
              </button>
              {adminAccess === "allowed" && route.id && (() => {
                const managed = adminRoutes.find(item => item.id === route.id);
                if (!managed) return null;
                return (
                  <>
                    <div className="route-admin-actions">
                      <button type="button" onClick={() => startEditRoute(managed)}>Upravit</button>
                      <button type="button" onClick={() => void changeRouteState(managed.id, managed.name, "deactivate")}>Deaktivovat</button>
                      <button type="button" className="danger" onClick={() => void changeRouteState(managed.id, managed.name, "delete")}>Smazat</button>
                    </div>
                    <p className="route-admin-source">{managed.isStatic ? "Mapa je součástí kódu aplikace." : "Mapa je nahraná v úložišti aplikace."}</p>
                  </>
                );
              })()}
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
                  <p>{selectedRoute.route.distance} · Běh i chůze{selectedRoute.route.badge ? ` · ${selectedRoute.route.badge}` : ""}</p>
                </div>
                <button type="button" onClick={() => setSelectedRoute(null)} aria-label="Zavřít podrobnosti">×</button>
              </div>
              <p className="route-detail-description">{selectedRoute.route.description}</p>
              {selectedRoute.route.gpxUrl && (
                <div className="route-detail-map">
                  <RouteMap gpxUrl={selectedRoute.route.gpxUrl} mapUrl={selectedRoute.route.mapUrl} name={selectedRoute.route.name} laps={selectedRoute.route.laps} interactive mapStyle="standard" />
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
