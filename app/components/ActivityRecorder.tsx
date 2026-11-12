"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, Footprints, Gauge, MapPin, Pause, Play, Square, Smartphone } from "lucide-react";
import type { ActivityType } from "../types";
import InstallPwaPrompt from "./InstallPwaPrompt";

type Point = { lat:number; lon:number; accuracy:number; timestamp:number };

const distanceBetween = (a:Point,b:Point) => {
  const R=6371000, toRad=(v:number)=>v*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};
const formatTime=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
const formatPace=(seconds:number,km:number)=>{
  if(km<=0) return "—";
  const pace=Math.round(seconds/km);
  return `${Math.floor(pace/60)}:${String(pace%60).padStart(2,"0")} min/km`;
};

export default function ActivityRecorder({ type, onFinished }:{
  type:ActivityType;
  onFinished?: (draft:{type:ActivityType; km:number; seconds:number}) => void;
}) {
  const [running,setRunning]=useState(false);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [distance,setDistance]=useState(0);
  const [accuracy,setAccuracy]=useState<number|null>(null);
  const [gpsError,setGpsError]=useState("");
  const [requestingLocation,setRequestingLocation]=useState(false);
  const [backgrounded,setBackgrounded]=useState(false);
  const [gpsUnavailable,setGpsUnavailable]=useState(false);
  const [initialGpsState,setInitialGpsState]=useState<"checking"|"ready"|"off">("off");

  const startedAtRef=useRef<number|null>(null);
  const pausedAtRef=useRef<number|null>(null);
  const pausedTotalRef=useRef(0);
  const lastPointRef=useRef<Point|null>(null);
  const watchIdRef=useRef<number|null>(null);
  const distanceRef=useRef(0);
  const wakeLockRef=useRef<WakeLockSentinel|null>(null);
  const runningRef=useRef(false);
  const pausedRef=useRef(false);
  const gpsUnavailableRef=useRef(false);
  const acquiringFixRef=useRef(false);
  const gpsWatchdogFailuresRef=useRef(0);
  const lastGpsSuccessAtRef=useRef<number|null>(null);

  const activityName=type==="chůze"?"Chůze":"Běh";
  const icon=type==="chůze"?<Footprints size={20}/>:<Activity size={20}/>;

  const activeSecondsAt = (now:number) => {
    const start=startedAtRef.current;
    if(start===null) return 0;
    const currentPause=pausedAtRef.current ? now-pausedAtRef.current : 0;
    return Math.max(0,Math.round((now-start-pausedTotalRef.current-currentPause)/1000));
  };

  const reset=()=>{
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    setDistance(0);
    setAccuracy(null);
    setGpsError("");
    setBackgrounded(false);
    setRequestingLocation(false);
    setGpsUnavailable(false);
    runningRef.current=false;
    pausedRef.current=false;
    gpsUnavailableRef.current=false;
    acquiringFixRef.current=false;
    gpsWatchdogFailuresRef.current=0;
    lastGpsSuccessAtRef.current=null;
    startedAtRef.current=null;
    pausedAtRef.current=null;
    pausedTotalRef.current=0;
    lastPointRef.current=null;
    distanceRef.current=0;
  };

  const acquireWakeLock=async()=>{
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current=await navigator.wakeLock.request("screen");
      }
    } catch {}
  };

  const releaseWakeLock=()=>{
    wakeLockRef.current?.release().catch(()=>{});
    wakeLockRef.current=null;
  };

  const stopGps=()=>{
    if(watchIdRef.current!==null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current=null;
    lastPointRef.current=null;
  };

  const markGpsUnavailable=(message:string)=>{
    if(!runningRef.current) {
      setGpsUnavailable(true);
      setGpsError(message);
      return;
    }
    gpsUnavailableRef.current=true;
    setGpsUnavailable(true);
    setGpsError(message);
    if(!pausedRef.current) {
      pausedAtRef.current=Date.now();
      pausedRef.current=true;
      setElapsed(activeSecondsAt(Date.now()));
      setPaused(true);
    }
    stopGps();
    releaseWakeLock();
  };

  const startGps=(onFirstFix?:()=>void)=>{
    if(!("geolocation" in navigator)){
      setGpsError("Tento prohlížeč nepodporuje GPS.");
      return false;
    }
    setGpsError("");
    try {
      watchIdRef.current=navigator.geolocation.watchPosition(pos=>{
        const p:Point={
          lat:pos.coords.latitude,
          lon:pos.coords.longitude,
          accuracy:pos.coords.accuracy,
          timestamp:pos.timestamp
        };
        setAccuracy(Math.round(p.accuracy));
        lastGpsSuccessAtRef.current = Date.now();
        gpsWatchdogFailuresRef.current = 0;
        if (acquiringFixRef.current) {
          if (p.accuracy <= 75) {
            lastPointRef.current = p;
            acquiringFixRef.current = false;
            onFirstFix?.();
          }
          return;
        }
        if(!runningRef.current || pausedRef.current || gpsUnavailableRef.current || p.accuracy>50) return;

        const previous=lastPointRef.current;
        if(!previous){
          lastPointRef.current=p;
          return;
        }

        const delta=distanceBetween(previous,p);
        const timeDelta=Math.max(0,(p.timestamp-previous.timestamp)/1000);
        if(delta>250 || (timeDelta>0 && delta/timeDelta>45)) return;
        if(delta<2 && timeDelta<8) return;

        distanceRef.current+=delta;
        setDistance(distanceRef.current);
        lastPointRef.current=p;
      },err=>{
        if(err.code===1) {
          setInitialGpsState("off");
          markGpsUnavailable("Přístup k poloze není povolen. Zapni polohu v telefonu a měření bude pozastaveno.");
        } else if(err.code===2) {
          setInitialGpsState("off");
          markGpsUnavailable("GPS není dostupné. Zapni polohu v telefonu a měření je pozastaveno.");
        } else {
          setGpsError("GPS signál se nepodařilo získat. Zkontroluj polohu v telefonu.");
        }
        setRequestingLocation(false);
      },{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
    } catch {
      setGpsError("GPS se nepodařilo spustit.");
      return false;
    }
    return true;
  };

  const start=()=>{
    if(!("geolocation" in navigator)){
      setInitialGpsState("off");
      setGpsError("Tento prohlížeč nepodporuje GPS.");
      return;
    }

    setGpsError("");
    setInitialGpsState("checking");
    setGpsUnavailable(false);
    gpsUnavailableRef.current=false;
    setRequestingLocation(true);
    setInitialGpsState("checking");
    acquiringFixRef.current=true;
    gpsWatchdogFailuresRef.current=0;
    lastGpsSuccessAtRef.current=null;
    setElapsed(0);
    setDistance(0);
    setPaused(false);
    setRunning(false);
    runningRef.current=false;
    pausedRef.current=false;
    startedAtRef.current=null;
    pausedAtRef.current=null;
    pausedTotalRef.current=0;
    distanceRef.current=0;
    lastPointRef.current=null;

    const started=startGps(()=>{
      if(runningRef.current) return;
      startedAtRef.current=Date.now();
      runningRef.current=true;
      pausedRef.current=false;
      setRequestingLocation(false);
      setRunning(true);
      setGpsUnavailable(false);
      setInitialGpsState("ready");
      void acquireWakeLock();
    });

    if(!started) setRequestingLocation(false);
  };

  const pause=()=>{
    if(!runningRef.current) return;

    if(!pausedRef.current){
      pausedAtRef.current=Date.now();
      pausedRef.current=true;
      setElapsed(activeSecondsAt(Date.now()));
      setPaused(true);
      lastPointRef.current=null;
      return;
    }

    const now=Date.now();
    if(pausedAtRef.current) pausedTotalRef.current+=now-pausedAtRef.current;
    pausedAtRef.current=null;
    pausedRef.current=false;
    gpsUnavailableRef.current=false;
    setPaused(false);
    setGpsUnavailable(false);
    setGpsError("");
    lastPointRef.current=null;
    void acquireWakeLock();
  };

  const retryGps=()=>{
    if(!runningRef.current) return;
    stopGps();
    setRequestingLocation(true);
    setInitialGpsState("checking");
    setGpsUnavailable(false);
    gpsUnavailableRef.current=false;
    acquiringFixRef.current=true;
    gpsWatchdogFailuresRef.current=0;
    lastGpsSuccessAtRef.current=null;
    setGpsError("");
    startGps(()=>{
      const now=Date.now();
      if(pausedAtRef.current) pausedTotalRef.current+=now-pausedAtRef.current;
      pausedAtRef.current=null;
      pausedRef.current=false;
      setPaused(false);
      setRequestingLocation(false);
      setGpsUnavailable(false);
      gpsUnavailableRef.current=false;
      setGpsError("");
      setInitialGpsState("ready");
      lastPointRef.current=null;
      void acquireWakeLock();
    });
  };

  const stop=()=>{
    if(!runningRef.current) return;
    stopGps();
    releaseWakeLock();
    const end=Date.now();
    if(pausedAtRef.current) pausedTotalRef.current+=end-pausedAtRef.current;
    const finalSeconds=Math.max(1,activeSecondsAt(end));
    setElapsed(finalSeconds);
    setRunning(false);
    setPaused(false);
    runningRef.current=false;
    pausedRef.current=false;
    pausedAtRef.current=null;
    setRequestingLocation(false);
  };

  useEffect(() => {
    let active = true;
    if (!("geolocation" in navigator)) {
      setInitialGpsState("off");
      return () => { active = false; };
    }
    const check = async () => {
      try {
        if ("permissions" in navigator && navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (!active) return;
          if (permission.state === "denied") {
            setInitialGpsState("off");
            return;
          }
          if (permission.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              pos => { if (active) { setAccuracy(Math.round(pos.coords.accuracy)); setInitialGpsState(pos.coords.accuracy <= 75 ? "ready" : "off"); } },
              () => { if (active) setInitialGpsState("off"); },
              { enableHighAccuracy: true, maximumAge: 0, timeout: 2500 }
            );
            return;
          }
          setInitialGpsState("ready");
          return;
        }
        setInitialGpsState("ready");
      } catch {
        if (active) setInitialGpsState("ready");
      }
    };
    void check();
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    if(!running) return;
    const timer=window.setInterval(()=>{
      setElapsed(activeSecondsAt(Date.now()));
    },1000);
    return()=>window.clearInterval(timer);
  },[running]);

  useEffect(()=>{
    if(!running) return;

    const watchdog=window.setInterval(()=>{
      navigator.geolocation.getCurrentPosition(
        pos=>{
          if(!runningRef.current || pausedRef.current) return;
          lastGpsSuccessAtRef.current = Date.now();
          gpsWatchdogFailuresRef.current = 0;
          setAccuracy(Math.round(pos.coords.accuracy));
          if(gpsUnavailableRef.current && pos.coords.accuracy <= 75) {
            setGpsUnavailable(false);
            gpsUnavailableRef.current=false;
            setGpsError("");
            setPaused(false);
            pausedRef.current=false;
            if (pausedAtRef.current) {
              pausedTotalRef.current += Date.now() - pausedAtRef.current;
              pausedAtRef.current = null;
            }
            lastPointRef.current = null;
            void acquireWakeLock();
          }
        },
        err=>{
          if(!runningRef.current || pausedRef.current) return;
          gpsWatchdogFailuresRef.current += 1;
          const lastSuccessAge = lastGpsSuccessAtRef.current === null
            ? Infinity
            : Date.now() - lastGpsSuccessAtRef.current;

          if(err.code===1 || err.code===2) {
            markGpsUnavailable(err.code===1
              ? "Přístup k poloze není povolen. Zapni polohu v telefonu a měření je pozastaveno."
              : "GPS není dostupné. Zapni polohu v telefonu a měření je pozastaveno.");
            return;
          }

          // Některé telefony po vypnutí systémové polohy vrátí nejprve timeout
          // místo chyby 2. Teprve několik po sobě jdoucích timeoutů označí GPS
          // jako nedostupné, aby krátký výpadek signálu nezastavil měření.
          if(err.code===3 && gpsWatchdogFailuresRef.current >= 3 && lastSuccessAge > 8000) {
            markGpsUnavailable("GPS není dostupné. Zapni polohu v telefonu a měření je pozastaveno.");
          }
        },
        {enableHighAccuracy:true,maximumAge:0,timeout:2000}
      );
    },2500);

    return()=>window.clearInterval(watchdog);
  },[running]);

  useEffect(()=>{
    const onVisibility=()=>{
      const hidden=document.visibilityState==="hidden";
      if(runningRef.current) setBackgrounded(hidden);
      if(!hidden && runningRef.current) void acquireWakeLock();
    };
    document.addEventListener("visibilitychange",onVisibility);
    return()=>document.removeEventListener("visibilitychange",onVisibility);
  },[]);

  useEffect(()=>()=>{stopGps();releaseWakeLock();},[]);

  const finishDraft=()=>{
    if(distanceRef.current<=0.01 || elapsed<=0){
      setGpsError("Nejdřív naměř alespoň malou vzdálenost.");
      return;
    }
    onFinished?.({
      type,
      km:Number((distanceRef.current/1000).toFixed(3)),
      seconds:elapsed
    });
    reset();
  };

  const status=requestingLocation
    ? "Získávám polohu…"
    : gpsUnavailable
      ? "GPS vypnuto"
      : running
        ? paused
          ? "Pozastaveno"
          : backgrounded
            ? "Aplikace na pozadí"
            : "GPS aktivní"
        : elapsed>0
          ? "Měření dokončeno"
          : initialGpsState === "off"
            ? "GPS vypnuto"
            : "Připraveno";

  const distanceKm=distance/1000;
  const canContinue=!running && !requestingLocation && distanceKm>0.01 && elapsed>0;

  return <section className="activity-recorder" aria-label={`Měření ${activityName.toLowerCase()}`}>
    {!running && elapsed===0 && !requestingLocation && <InstallPwaPrompt compact />}

    <div className="activity-recorder-header">
      <div>
        <span className="activity-recorder-eyebrow">{icon} MĚŘENÍ GPS</span>
        <h2>{activityName} v reálném čase</h2>
      </div>
      <span className={`activity-recorder-status ${paused?"is-paused":gpsUnavailable||initialGpsState==="off"?"is-error":backgrounded?"is-background":""}`}>{status}</span>
    </div>

    {!running && elapsed===0 ? (
      <p className="activity-recorder-help">
        Nemáš hodinky? Nevadí. Telefon změří vzdálenost a čas pomocí GPS. Po skončení můžeš výsledek doplnit o popis a fotografie a teprve potom uložit jako záznam.
      </p>
    ) : null}

    <div className="activity-recorder-metrics">
      <div><MapPin size={18}/><strong>{distanceKm.toFixed(2)}</strong><small>km</small></div>
      <div><Gauge size={18}/><strong>{formatTime(elapsed)}</strong><small>čas</small></div>
      <div><Activity size={18}/><strong>{formatPace(elapsed,distanceKm)}</strong><small>tempo</small></div>
    </div>

    {accuracy!==null && <div className="activity-recorder-gps">Přesnost GPS přibližně {accuracy} m{paused?" · měření pozastaveno":""}</div>}
    {gpsError && <div className="activity-recorder-error">{gpsError}</div>}
    {backgrounded && <div className="activity-recorder-warning"><Smartphone size={18}/> Telefon je zamčený nebo aplikace běží na pozadí. Prohlížeč může GPS omezit; po návratu zkontroluj výsledek.</div>}

    <div className="activity-recorder-actions">
      {!running && elapsed===0 && !requestingLocation && <button type="button" className="run-primary-button gps-action-full" onClick={start}><Play size={18}/> Spustit {activityName.toLowerCase()}</button>}
      {requestingLocation && <button type="button" className="run-primary-button gps-action-full" disabled><MapPin size={18}/> Získávám polohu…</button>}
      {running && !gpsUnavailable && <button type="button" className="run-secondary-button gps-action" onClick={pause}>{paused?<Play size={18}/>:<Pause size={18}/>} {paused?"Pokračovat":"Pozastavit"}</button>}
      {running && gpsUnavailable && <button type="button" className="run-secondary-button gps-action" onClick={retryGps}><MapPin size={18}/> Zkusit GPS znovu</button>}
      {running && <button type="button" className="run-primary-button gps-action" onClick={stop}><Square size={17}/> Ukončit</button>}
      {canContinue && <button type="button" className="run-primary-button gps-action" onClick={finishDraft}>Pokračovat k vytvoření záznamu</button>}
      {!running && elapsed>0 && <button type="button" className="run-secondary-button gps-action" onClick={reset}>Zahodit měření</button>}
    </div>
  </section>;
}
