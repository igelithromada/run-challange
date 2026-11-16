"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Droplets, Moon, Sun } from "lucide-react";

function weatherKind(type = "") {
  const value = type.toUpperCase();
  if (value.includes("THUNDER")) return "storm";
  if (value.includes("SNOW") || value.includes("SLEET") || value.includes("HAIL")) return "snow";
  if (value.includes("RAIN")) return "rain";
  if (value.includes("DRIZZLE")) return "drizzle";
  if (value.includes("FOG") || value.includes("HAZE")) return "fog";
  if (value.includes("PARTLY") || value.includes("MOSTLY")) return "partly";
  if (value.includes("CLOUD")) return "cloud";
  if (value.includes("CLEAR") || value.includes("SUN")) return "sun";
  return "partly";
}

export function weatherDescription(type = "") {
  const kind = weatherKind(type);
  if (kind === "partly") return "Polojasno";
  if (kind === "cloud") return "Zataženo";
  if (kind === "sun") return "Jasno";
  if (kind === "rain") return "Déšť";
  if (kind === "drizzle") return "Mrholení";
  if (kind === "storm") return "Bouřka";
  if (kind === "snow") return "Sněžení";
  if (kind === "fog") return "Mlha";
  return "Polojasno";
}

export default function WeatherVisual({
  type,
  size,
  className = "",
  night = false,
}: {
  type?: string;
  size: number;
  className?: string;
  night?: boolean;
}) {
  const kind = weatherKind(type);
  const Icon =
    kind === "storm" ? CloudLightning :
    kind === "snow" ? CloudSnow :
    kind === "rain" ? CloudRain :
    kind === "drizzle" ? CloudDrizzle :
    kind === "fog" ? CloudFog :
    kind === "cloud" ? Cloud :
    night && kind === "sun" ? Moon : Sun;

  return (
    <span
      className={`weather-visual-wrap weather-visual-${kind} ${night && kind === "sun" ? "weather-night-clear" : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-label={weatherDescription(type)}
      title={weatherDescription(type)}
    >
      {kind === "partly" ? (
        <>
          <Sun className="weather-sun" size={Math.round(size * .58)} strokeWidth={2.7} />
          <Cloud className="weather-cloud" size={Math.round(size * .58)} strokeWidth={1.9} />
        </>
      ) : kind === "rain" || kind === "drizzle" ? (
        <>
          <Cloud className="weather-visual-cloud" size={Math.round(size * .72)} strokeWidth={1.9} />
          <Droplets className="weather-visual-drops" size={Math.max(16, Math.round(size * .46))} strokeWidth={2.5} />
        </>
      ) : (
        <Icon className="weather-visual-icon" size={Math.round(size * .72)} strokeWidth={1.9} />
      )}
    </span>
  );
}
