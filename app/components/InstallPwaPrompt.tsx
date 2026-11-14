"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { ActivityTypeIcon } from "./ActivityTypeSelector";
import type { ActivityType } from "../types";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome:"accepted"|"dismissed" }>;
};

export default function InstallPwaPrompt({compact=false, type="běh"}:{compact?:boolean; type?:ActivityType}) {
  const [event,setEvent]=useState<BeforeInstallPromptEvent|null>(null);
  const [installed,setInstalled]=useState(false);
  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
    setInstalled(standalone);
    const onBefore=(e:Event)=>{
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled=()=>{setInstalled(true);setEvent(null);};
    window.addEventListener("beforeinstallprompt",onBefore);
    window.addEventListener("appinstalled",onInstalled);
    return()=>{window.removeEventListener("beforeinstallprompt",onBefore);window.removeEventListener("appinstalled",onInstalled);};
  },[]);
  if(installed || !event) return null;
  const install=async()=>{
    await event.prompt();
    const choice=await event.userChoice;
    if(choice.outcome==="accepted") setInstalled(true);
    setEvent(null);
  };
  return <div className={`pwa-install-prompt ${compact?"pwa-install-prompt-compact":""}`}>
    <div className="pwa-install-copy"><ActivityTypeIcon type={type} size={24}/><div><strong>Pro GPS měření doporučujeme nainstalovat aplikaci</strong><span>Instalace na plochu usnadní měření a umožní nám lépe využít funkce telefonu.</span></div></div>
    <button type="button" className="run-secondary-button" onClick={install}><Download size={17}/> Nainstalovat aplikaci</button>
  </div>;
}
