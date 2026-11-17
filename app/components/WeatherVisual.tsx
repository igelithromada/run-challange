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

const cloud = "M6 16a4 4 0 0 1-.9-7.9A6 6 0 0 1 16.7 6 4.5 4.5 0 1 1 1.8 10H6Z";

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
      {kind === "sun" ? (night ? moon : sun) : kind === "partly" ? <>
        <g transform="translate(-.3,-.3) scale(.7)">{night ? moon : sun}</g>
        <path className="wx-cloud" d="M9 21a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 18 12a4.5 4.5 0 1 1 .5 9H9Z" />
      </> : <>
        <path className="wx-cloud" d={cloud} />
        {kind === "rain" && <path className="wx-rain" d="m7 19-1 3m7-3-1 3m7-3-1 3" />}
        {kind === "drizzle" && <path className="wx-rain" d="M7 20v.5m5 1v.5m5-2v.5" />}
        {kind === "storm" && <><path className="wx-lightning" d="m13 16-4 5h4l-1 3 5-6h-4l1-2" /><path className="wx-rain" d="m5 19-.6 2m15-2-.6 2" /></>}
        {kind === "snow" && <path className="wx-snow" d="M7 19v4m-2-2h4m6-2v4m-2-2h4" />}
        {kind === "fog" && <path className="wx-cloud" d="M3 19h18M5 22h14" />}
      </>}
    </svg>
  </span>;
}
