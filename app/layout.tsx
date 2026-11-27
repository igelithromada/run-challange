import "./styles.css";
import "./professional-ui.css";
import "./visual-hierarchy.css";
import "./chat.css";
import "./appearance.css";
import { DEFAULT_COLOR, THEME_CACHE_KEY, THEMES, TIME_PERIODS } from "./lib/appearance";
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
  icons: {
    icon: { url: "/lhota-icon.svg", type: "image/svg+xml" },
    apple: { url: "/lhota-apple-touch.png", sizes: "180x180", type: "image/png" },
  },
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
          var s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_CACHE_KEY)})||"null");
          if(!s)return;
          var t=s.theme==="white"?"light":s.theme;
          if(!${JSON.stringify(THEMES)}.includes(t))t="default";
          var r=document.documentElement;
          r.dataset.theme=t==="light"?"white":t;
          r.toggleAttribute("data-solid-theme",s.gradientEnabled===false);
          if(t==="auto")r.dataset.autoPeriod=${JSON.stringify(TIME_PERIODS)}.find(function(p){return new Date().getHours()<p[0]})[1];
          if(t==="custom")r.style.setProperty("--custom-theme-color",/^#[0-9a-f]{6}$/i.test(s.customColor)?s.customColor:${JSON.stringify(DEFAULT_COLOR)});
        }catch(e){}})();` }} />
      </head>
      <body><ClientLayout>{children}</ClientLayout></body>
    </html>
  );
}
