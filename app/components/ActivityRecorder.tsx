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

export default function ActivityRecorder({ type, onFinished }:{type:ActivityType; onFinished?: (draft:{type:ActivityType; km:number; seconds:number}) => void}) {
  const [running,setRunning]=useState(false);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [distance,setDistance]=useState(0);
  const [accuracy,setAccuracy]=useState<number|null>(null);
  const [gpsError,setGpsError]=useState("");
  const [requestingLocation,setRequestingLocation]=useState(false);
  const [backgrounded,setBackgrounded]=useState(false);
  const [gpsUnavailable,setGpsUnavailable]=useState(false);
  const startedAtRef=useRef<number|null>(null);
  const pausedAtRef=useRef<number|null>(null);
  const pausedTotalRef=useRef(0);
  const lastPointRef=useRef<Point|null>(null);
  const watchIdRef=useRef<number|null>(null);
  const distanceRef=useRef(0);
  const wakeLockRef=useRef<WakeLockSentinel|null>(null);
  const gpsLostRef=useRef(false);

  const activityName=type==="chůze"?"Chůze":"Běh";
  const icon=type==="chůze"?<Footprints size={20}/>:<Activity size={20}/>;

  const reset=()=>{
    setRunning(false); setPaused(false); setElapsed(0); setDistance(0); setAccuracy(null);
    setGpsError(""); setBackgrounded(false); setRequestingLocation(false); setGpsUnavailable(false);
    gpsLostRef.current=false;
    startedAtRef.current=null; pausedAtRef.current=null; pausedTotalRef.current=0; lastPointRef.current=null;
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

  const startGps=(onFirstFix?:()=>void)=>{
    if(!("geolocation" in navigator)){ setGpsError("Tento prohlížeč nepodporuje GPS."); return false; }
    setGpsError("");
    watchIdRef.current=navigator.geolocation.watchPosition(pos=>{
      const p:Point={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy,timestamp:pos.timestamp};
      setAccuracy(Math.round(p.accuracy));
      if(paused || p.accuracy>50) return;
      const previous=lastPointRef.current;
      if(!previous){
        lastPointRef.current=p;
        onFirstFix?.();
        return;
      }
      const delta=distanceBetween(previous,p);
      const timeDelta=Math.max(0,(p.timestamp-previous.timestamp)/1000);
      // Ignoruj zjevné GPS skoky. Při chůzi/běhu je 45 m/s bezpečná horní mez.
      if(delta>250 || (timeDelta>0 && delta/timeDelta>45)){ return; }
      if(delta<2 && timeDelta<8){ return; }
      distanceRef.current+=delta;
      setDistance(distanceRef.current);
      lastPointRef.current=p;
    },err=>{
      setRequestingLocation(false);
      if(err.code===2){
        gpsLostRef.current=true;
        if(running && !paused){
          pausedAtRef.current=Date.now();
          setElapsed(Math.max(0,Math.round((Date.now()-(startedAtRef.current||Date.now())-pausedTotalRef.current)/1000)));
          setPaused(true);
        }
        setGpsUnavailable(true);
        setGpsError("GPS není dostupné. Zapni polohu v telefonu a potom měření obnov.");
        return;
      }
      if(err.code===1){
        setGpsUnavailable(true);
        setGpsError("Přístup k poloze není povolen. Povol polohu pro aplikaci a zkus to znovu.");
        if(running && !paused){
          pausedAtRef.current=Date.now();
          setElapsed(Math.max(0,Math.round((Date.now()-(startedAtRef.current||Date.now())-pausedTotalRef.current)/1000)));
          setPaused(true);
        }
        return;
      }
      setGpsError("GPS signál se nepodařilo získat. Zkus to znovu.");
    },{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
    return true;
  };

  const start=()=>{
    if(!("geolocation" in navigator)){setGpsError("Tento prohlížeč nepodporuje GPS.");return;}
    setGpsError("");
    setRequestingLocation(true);
    startedAtRef.current=null;
    pausedAtRef.current=null;
    pausedTotalRef.current=0;
    distanceRef.current=0;
    lastPointRef.current=null;
    setElapsed(0); setDistance(0); setPaused(false); setRunning(false);
    if(!startGps(()=>{
      startedAtRef.current=Date.now();
      setRequestingLocation(false);
      setRunning(true);
      void acquireWakeLock();
    })){ setRequestingLocation(false); }
  };

  const pause=()=>{
    if(!running) return;
    if(!paused){
      const now=Date.now();
      pausedAtRef.current=now;
      setElapsed(Math.max(0,Math.round((now-(startedAtRef.current||now)-pausedTotalRef.current)/1000)));
      setPaused(true);
      lastPointRef.current=null;
    } else {
      if(pausedAtRef.current) pausedTotalRef.current+=Date.now()-pausedAtRef.current;
      pausedAtRef.current=null;
      setPaused(false);
      setGpsError("");
      setGpsUnavailable(false);
      gpsLostRef.current=false;
      lastPointRef.current=null;
    }
  };

  const retryGps=()=>{
    if(!running) return;
    stopGps();
    setRequestingLocation(true);
    setGpsUnavailable(false);
    setGpsError("");
    startGps(()=>{
      const now=Date.now();
      if(pausedAtRef.current) pausedTotalRef.current+=now-pausedAtRef.current;
      pausedAtRef.current=null;
      gpsLostRef.current=false;
      setPaused(false);
      setRequestingLocation(false);
      setGpsUnavailable(false);
      setGpsError("");
      lastPointRef.current=null;
      void acquireWakeLock();
    });
  };

  const stop=()=>{
    if(!running) return;
    stopGps(); releaseWakeLock();
    const end=Date.now();
    if(pausedAtRef.current) pausedTotalRef.current+=end-pausedAtRef.current;
    const startMs=startedAtRef.current||end;
    const activeSeconds=Math.max(1,Math.round((end-startMs-pausedTotalRef.current)/1000));
    setElapsed(activeSeconds); setRunning(false); setPaused(false);
    pausedAtRef.current=null;
  };

  useEffect(()=>{
    if(!running) return;
    const timer=window.setInterval(()=>{
      const startMs=startedAtRef.current||Date.now();
      const pauseNow=pausedAtRef.current ? Date.now()-pausedAtRef.current : 0;
      setElapsed(Math.max(0,Math.round((Date.now()-startMs-pausedTotalRef.current-pauseNow)/1000)));
    },1000);
    return()=>window.clearInterval(timer);
  },[running]);

  useEffect(()=>{
    if(!running) return;
    const watchdog=window.setInterval(()=>{
      navigator.geolocation.getCurrentPosition(
        ()=>{},
        err=>{
          if(err.code===2){
            gpsLostRef.current=true;
            if(!paused && !pausedAtRef.current){
              const now=Date.now();
              pausedAtRef.current=now;
              setElapsed(Math.max(0,Math.round((now-(startedAtRef.current||now)-pausedTotalRef.current)/1000)));
              setPaused(true);
            }
            setGpsUnavailable(true);
            setGpsError("GPS není dostupné. Zapni polohu v telefonu a potom měření obnov.");
          }
        },
        {enableHighAccuracy:true,maximumAge:0,timeout:5000}
      );
    },8000);
    return()=>window.clearInterval(watchdog);
  },[running,paused]);

  useEffect(()=>{
    const onVisibility=()=>{
      const hidden=document.visibilityState==="hidden";
      if(running) setBackgrounded(hidden);
      if(!hidden && running) void acquireWakeLock();
    };
    document.addEventListener("visibilitychange",onVisibility);
    return()=>document.removeEventListener("visibilitychange",onVisibility);
  },[running]);

  useEffect(()=>()=>{stopGps();releaseWakeLock();},[]);

  const finishDraft=()=>{
    if(distanceRef.current<=0.01 || elapsed<=0){setGpsError("Nejdřív naměř alespoň malou vzdálenost.");return;}
    onFinished?.({ type, km:Number((distanceRef.current/1000).toFixed(3)), seconds:elapsed });
    reset();
  };

  const status=requestingLocation?"Čekám na polohu":gpsUnavailable?"GPS nedostupné":running?(paused?"Pozastaveno":backgrounded?"Aplikace byla na pozadí":"GPS aktivní"):elapsed>0?"Měření dokončeno":"Připraveno";
  const distanceKm=distance/1000;
  const canContinue=!running && !requestingLocation && distanceKm>0.01 && elapsed>0;

  return <section className="activity-recorder" aria-label={`Měření ${activityName.toLowerCase()}`}>
    {!running && elapsed===0 && !requestingLocation && <InstallPwaPrompt compact />}
    <div className="activity-recorder-header">
      <div><span className="activity-recorder-eyebrow">{icon} MĚŘENÍ GPS</span><h2>{activityName} v reálném čase</h2></div>
      <span className={`activity-recorder-status ${paused?"is-paused":backgrounded?"is-background":""}`}>{status}</span>
    </div>
    {!running && elapsed===0 ? <p className="activity-recorder-help">Telefon změří vzdálenost a čas pomocí GPS. Po skončení můžeš výsledek doplnit o popis a fotografie a teprve potom uložit jako záznam.</p> : null}
    <div className="activity-recorder-metrics">
      <div><MapPin size={18}/><strong>{distanceKm.toFixed(2)}</strong><small>km</small></div>
      <div><Gauge size={18}/><strong>{formatTime(elapsed)}</strong><small>čas</small></div>
      <div><Activity size={18}/><strong>{formatPace(elapsed,distanceKm)}</strong><small>tempo</small></div>
    </div>
    {accuracy!==null && <div className="activity-recorder-gps">Přesnost GPS přibližně {accuracy} m{paused?" · měření pozastaveno":""}</div>}
    {gpsError && <div className="activity-recorder-error">{gpsError}</div>}
    {backgrounded && <div className="activity-recorder-warning"><Smartphone size={18}/> Telefon je zamčený nebo aplikace běží na pozadí. Prohlížeč může GPS omezit; po návratu zkontroluj výsledek.</div>}
    <div className="activity-recorder-actions">
      {!running && elapsed===0 && !requestingLocation && <button type="button" className="run-primary-button" onClick={start}><Play size={18}/> Spustit {activityName.toLowerCase()}</button>}
      {requestingLocation && <button type="button" className="run-primary-button" disabled><MapPin size={18}/> Získávám polohu…</button>}
      {running && !gpsUnavailable && <button type="button" className="run-secondary-button" onClick={pause}>{paused?<Play size={18}/>:<Pause size={18}/>} {paused?"Pokračovat":"Pozastavit"}</button>}
      {running && gpsUnavailable && <button type="button" className="run-secondary-button" onClick={retryGps}><MapPin size={18}/> Zkusit GPS znovu</button>}
      {running && <button type="button" className="run-primary-button" onClick={stop}><Square size={17}/> Ukončit</button>}
      {canContinue && <button type="button" className="run-primary-button gps-finished-primary" onClick={finishDraft}>Pokračovat k vytvoření záznamu</button>}
      {!running && elapsed>0 && <button type="button" className="run-secondary-button gps-finished-secondary" onClick={reset}>Zahodit měření</button>}
    </div>
  </section>;
}
