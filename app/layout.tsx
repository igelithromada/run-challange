import "./globals.css";
import "./fixes.css";
import "./polish.css";
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=JSON.parse(localStorage.getItem("dolni-lhota-theme-v1")||"null");if(!s)return;var r=document.documentElement;var g="linear-gradient(180deg,#36D1DC,#5B86E5)";if(s.theme==="man")g="linear-gradient(180deg,#2980b9,#2c3e50)";else if(s.theme==="woman")g="linear-gradient(180deg,#ff7eb3,#ff758c)";else if(s.theme==="custom")g="linear-gradient(180deg,"+(s.customColor||"#36D1DC")+",#000000)";else if(s.theme==="auto"){var h=new Date().getHours(),l=h<6?20:h<10?70:h<16?90:h<20?60:30;g="linear-gradient(180deg,hsl(200,70%,"+l+"%),#000000)";}r.style.setProperty("--main-gradient",g);r.setAttribute("data-animations",s.animationsEnabled===false?"false":"true");}catch(e){}})();` }} />
      </head>
      <body><ClientLayout>{children}</ClientLayout></body>
    </html>
  );
}
