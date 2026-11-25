"use client";

function weatherKind(type = "") {
  const value = type.toUpperCase();
  if (value.includes("THUNDER")) return "storm";
  if (/SNOW|SLEET|HAIL/.test(value)) return "snow";
  if (value.includes("DRIZZLE")) return "drizzle";
  if (value.includes("RAIN")) return "rain";
  if (/FOG|HAZE/.test(value)) return "fog";
  if (/PARTLY|MOSTLY/.test(value)) return "partly";
  if (value.includes("CLOUD")) return "cloud";
  if (/CLEAR|SUN/.test(value)) return "sun";
  return "unknown";
}

export function weatherDescription(type = "") {
  const labels = { sun: "Jasno", partly: "Polojasno", cloud: "Zataženo", rain: "Déšť", drizzle: "Mrholení", storm: "Bouřka", snow: "Sněžení", fog: "Mlha", unknown: "Počasí není dostupné" };
  return labels[weatherKind(type)];
}

const cloud = "M6 16C3.8 16 2 14.2 2 12S3.8 8 6 8C6.8 4.7 9.4 3 12 3C15.5 3 18 5.4 18 8C20.2 8 22 9.8 22 12S20.2 16 18 16Z";

/** One viewBox for the entire symbol: CSS cannot move its cloud, rain or sun apart. */
export default function WeatherVisual({ type, size, className = "", night = false }: {
  type?: string; size: number; className?: string; night?: boolean;
}) {
  const kind = weatherKind(type);
  const label = weatherDescription(type);
  const sun = <g className="wx-sun"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></g>;
  const moon = <path className="wx-moon" d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10 10.5Z" />;
  return <span className={`weather-symbol weather-symbol-${kind} ${className}`} style={{ width: size, height: size }} role="img" aria-label={label} title={label}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === "sun" ? (night ? moon : sun) : kind === "partly" && night ? <>
        <path className="wx-moon" d="M7 2C3.7 2.2 1.7 4.7 2 7.5C2.4 11.9 7.6 13.6 10.7 10C6.4 10.1 4.4 5.6 7 2Z"/>
        <path className="wx-cloud" d="M9 21C4.7 21 4.4 15 8.9 14.6C10 14.5 10.7 14.6 11.1 14.6C12.2 9.1 18.6 9 19.5 14.4C23.7 14.9 23.5 21 19.1 21Z"/>
      </> : kind === "partly" ? <>
        <g transform="translate(-.3,-.3) scale(.7)">{sun}</g>
        <path className="wx-cloud" d="M9 21C6.8 21 5 19.2 5 17C5 15 6.4 13.4 8.4 13.1C9.1 10.5 11.2 9 13.7 9C16.4 9 18.5 10.8 19 13.1C21.2 13.5 22.5 15.2 22.5 17.1C22.5 19.3 20.7 21 18.5 21Z" />
      </> : <>
        <path className="wx-cloud" d={cloud} />
        {kind === "rain" && <path className="wx-rain" d="m7 19-1 3m7-3-1 3m7-3-1 3" />}
        {kind === "drizzle" && <path className="wx-rain" d="M7 20v.5m5 1v.5m5-2v.5" />}
        {kind === "storm" && <><path className="wx-lightning" d="m13 16-4 5h4l-1 3 5-6h-4l1-2" /><path className="wx-rain" d="m5 19-.6 2m15-2-.6 2" /></>}
        {kind === "snow" && <path className="wx-snow" strokeWidth="1.15" d="M7 18.7v4.6m-2-3.45 4 2.3m-4 0 4-2.3m7-1.15v4.6m-2-3.45 4 2.3m-4 0 4-2.3" />}
        {kind === "fog" && <path className="wx-cloud" d="M3 19h18M5 22h14" />}
      </>}
    </svg>
  </span>;
}
