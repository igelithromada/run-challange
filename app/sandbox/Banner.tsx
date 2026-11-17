"use client";
import {reset} from './store';
export default function SandboxBanner(){return <aside className="sandbox-banner"><b>TESTOVACÍ VERZE</b><span>Data pouze v tomto prohlížeči</span><button onClick={()=>{reset();window.location.href='/login';}}>Obnovit ukázková data</button></aside>;}
