export const MAX_GPX_SIZE = 15 * 1024 * 1024;
export function gpxDistanceLabel(text: string): string | null {
  if (!/<(?:[\w-]+:)?gpx\b/i.test(text) || !/<\/(?:[\w-]+:)?gpx\s*>/i.test(text)) return null;
  const segments = [...text.matchAll(/<(?:[\w-]+:)?(?:trkseg|rte)\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?(?:trkseg|rte)\s*>/gi)].map(match => match[1]);
  let total = 0, pointCount = 0;
  for (const segment of segments.length ? segments : [text]) {
    let previous: [number, number] | null = null;
    for (const point of segment.matchAll(/<(?:[\w-]+:)?(?:trkpt|rtept)\b([^>]*)>/gi)) {
      const latValue = /\blat\s*=\s*["']([^"']+)["']/i.exec(point[1])?.[1];
      const lonValue = /\blon\s*=\s*["']([^"']+)["']/i.exec(point[1])?.[1];
      if (latValue === undefined || lonValue === undefined) continue;
      const lat=Number(latValue), lon=Number(lonValue);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
      pointCount++;
      if(previous){
        const rad=(n:number)=>n*Math.PI/180;
        const a=Math.sin(rad(lat-previous[0])/2)**2+Math.cos(rad(lat))*Math.cos(rad(previous[0]))*Math.sin(rad(lon-previous[1])/2)**2;
        total+=6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
      }
      previous=[lat,lon];
    }
  }
  if(pointCount<2)return null;
  return total<1000 ? `${Math.round(total)} m` : `${(total/1000).toFixed(1)} km`;
}
