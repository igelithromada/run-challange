import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dolní Lhota v pohybu",
    short_name: "Lhota v pohybu",
    description: "Běžecká a pohybová výzva Dolní Lhota",
    start_url: "/",
    display: "standalone",
    background_color: "#194652",
    theme_color: "#17364b",
    lang: "cs",
    icons: [
      { src: "/lhota-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/lhota-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/lhota-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]
  };
}
