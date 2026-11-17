"use client";
import {useRouter} from 'next/navigation';
import {enterSandbox} from '../sandbox/auth';
export default function SandboxEntry(){const router=useRouter();return <main className="container"><section className="tile" style={{padding:'2rem',marginTop:'2rem'}}><h1>Testovací aplikace</h1><p>Dolní Lhota v pohybu · oddělené ukázkové prostředí</p><p>Data i fotografie se ukládají pouze v tomto prohlížeči. Ostrá aplikace ani skuteční uživatelé nejsou připojeni.</p><button className="run-primary-button" onClick={async()=>{await enterSandbox();router.push('/');}}>Vstoupit jako tester</button><p className="chart-hint">Skutečné přihlášení, Firebase, Cloudinary a doručování push upozornění tento test nenahrazuje.</p></section></main>;}
