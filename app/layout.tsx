import "./styles.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: {
    default: "Dolní Lhota v pohybu",
    template: "%s · Dolní Lhota v pohybu",
  },
  description: "Běžecká a pohybová výzva Dolní Lhota.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#17364b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: "html,body{background:var(--main-gradient,#36D1DC)}" }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=JSON.parse(localStorage.getItem("dolni-lhota-theme-v1")||"null");if(!s)return;var r=document.documentElement;var g="linear-gradient(180deg,#36D1DC,#5B86E5)";r.removeAttribute("data-theme");if(s.theme==="dark"){g="#000000";r.setAttribute("data-theme","dark");}else if(s.theme==="light"){g="#eef6fb";r.setAttribute("data-theme","light");}else if(s.theme==="white"){g="#ffffff";r.setAttribute("data-theme","white");}else if(s.theme==="man")g="linear-gradient(180deg,#2980b9,#2c3e50)";else if(s.theme==="woman")g="linear-gradient(180deg,#ff7eb3,#ff758c)";else if(s.theme==="custom")g="linear-gradient(180deg,"+(s.customColor||"#36D1DC")+",#000000)";else if(s.theme==="auto"){var h=new Date().getHours(),l=h<6?20:h<10?70:h<16?90:h<20?60:30;g="linear-gradient(180deg,hsl(200,70%,"+l+"%),#000000)";}r.style.setProperty("--main-gradient",g);r.setAttribute("data-animations",s.animationsEnabled===false?"false":"true");}catch(e){}})();` }} />
      </head>
      <body><ClientLayout>{children}</ClientLayout></body>
    </html>
  );
}
