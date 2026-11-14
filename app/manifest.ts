import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dolní Lhota v pohybu",
    short_name: "Lhota v pohybu",
    description: "Běžecká a pohybová výzva Dolní Lhota",
    start_url: "/",
    display: "standalone",
    background_color: "#36D1DC",
    theme_color: "#36D1DC",
    lang: "cs",
    icons: [{ src: "/run-icon-white.png", sizes: "512x512", type: "image/png", purpose: "maskable" }]
  };
}
