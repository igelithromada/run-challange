import "./styles.css";
import "./professional-ui.css";
import "./visual-hierarchy.css";
import "./chat.css";
import type { Metadata, Viewport } from "next";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17364b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: "html,body{background:var(--main-gradient,#36D1DC)}" }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=JSON.parse(localStorage.getItem("dolni-lhota-theme-v1")||"null");if(!s)return;var r=document.documentElement;var g="linear-gradient(180deg,#36D1DC,#5B86E5)";var solid="#36D1DC";r.removeAttribute("data-theme");var t=s.theme;if(t==="white")t="light";if(t!=="dark"&&t!=="light"&&t!=="default"&&t!=="auto"&&t!=="weather"&&t!=="custom"){t="default";}if(t==="dark"){g="#000000";solid="#000000";r.setAttribute("data-theme","dark");}else if(t==="light"){g="#f4f7f9";solid="#f4f7f9";r.setAttribute("data-theme","white");}else if(t==="custom"){solid=s.customColor||"#36D1DC";g="linear-gradient(180deg,"+solid+",#000000)";}else if(t==="auto"){var h=new Date().getHours(),l=h<6?20:h<10?70:h<16?90:h<20?60:30;solid="hsl(200,70%,"+l+"%)";g="linear-gradient(180deg,"+solid+",#000000)";}if(s.gradientEnabled===false)g=solid;r.style.setProperty("--main-gradient",g);}catch(e){}})();` }} />
      </head>
      <body><ClientLayout>{children}</ClientLayout></body>
    </html>
  );
}
