"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPinned } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";

type Props={gpxUrl?:string; name:string};

export default function RouteMap({gpxUrl,name}:Props){
  const el=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<MapLibreMap|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");

  useEffect(()=>{
    if(!el.current) return;
    let alive=true;
    let map:any;
    (async()=>{
      try{
        const ml=await import("maplibre-gl");
        if(!alive||!el.current)return;
        const response=await fetch(gpxUrl?"/api/routes/gpx?url="+encodeURIComponent(gpxUrl):"");
        if(!response.ok) throw new Error("GPX");
        const gpx=await response.text();
        const doc=new DOMParser().parseFromString(gpx,"application/xml");
        const points=Array.from(doc.querySelectorAll("trkpt")).map(p=>[
          Number(p.getAttribute("lon")),Number(p.getAttribute("lat"))
        ] as [number,number]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
        if(points.length<2) throw new Error("GPX bez bodů");

        const coords=points;
        const minX=Math.min(...coords.map(p=>p[0])), maxX=Math.max(...coords.map(p=>p[0]));
        const minY=Math.min(...coords.map(p=>p[1])), maxY=Math.max(...coords.map(p=>p[1]));

        map=new ml.Map({
          container:el.current,
          style:"https://tiles.openfreemap.org/styles/dark",
          center:[(minX+maxX)/2,(minY+maxY)/2],
          zoom:13,
          attributionControl:{compact:true}
        });
        mapRef.current=map;

        map.on("load",()=>{
          map.addSource("route",{type:"geojson",data:{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:coords}}});
          map.addLayer({id:"route-glow",type:"line",source:"route",paint:{"line-color":"#64d9ff","line-width":9,"line-opacity":.18,"line-blur":3}});
          map.addLayer({id:"route-line",type:"line",source:"route",paint:{"line-color":"#69e6a3","line-width":4,"line-opacity":.98}});
          map.addSource("route-start",{type:"geojson",data:{type:"Feature",properties:{},geometry:{type:"Point",coordinates:coords[0]}}});
          map.addSource("route-end",{type:"geojson",data:{type:"Feature",properties:{},geometry:{type:"Point",coordinates:coords[coords.length-1]}}});
          map.addLayer({id:"route-start",type:"circle",source:"route-start",paint:{"circle-radius":7,"circle-color":"#69e6a3","circle-stroke-color":"#10231d","circle-stroke-width":3}});
          map.addLayer({id:"route-end",type:"circle",source:"route-end",paint:{"circle-radius":7,"circle-color":"#ff6b78","circle-stroke-color":"#30171b","circle-stroke-width":3}});
          const bounds=new ml.LngLatBounds(coords[0],coords[0]);
          coords.forEach(p=>bounds.extend(p));
          map.fitBounds(bounds,{padding:{top:34,bottom:34,left:34,right:34},duration:0,maxZoom:16});
          if(alive)setState("ready");
        });
      }catch{
        if(alive)setState("error");
      }
    })();
    return()=>{alive=false;mapRef.current?.remove();mapRef.current=null;};
  },[gpxUrl]);

  return <div className="route-map-shell">
    <div ref={el} className="route-map" aria-label={"Mapa trasy "+name}/>
    {state==="loading"&&<div className="route-map-state"><LoaderCircle className="route-map-spin" size={20}/><span>Načítám trasu…</span></div>}
    {state==="error"&&<div className="route-map-state"><MapPinned size={20}/><span>Mapa této trasy není dostupná. Trasu lze stále otevřít v Mapy.com.</span></div>}
    {state==="ready"&&<div className="route-map-badge"><MapPinned size={14}/> GPX trasa</div>}
  </div>;
}