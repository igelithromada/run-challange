export type PhotoTransform = { zoom: number; x: number; y: number };
export type PhotoPoint = { x: number; y: number };
export function clampPhoto(transform: PhotoTransform, width: number, height: number): PhotoTransform {
  const zoom = Math.max(1, Math.min(4, transform.zoom));
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  return { zoom, x: clamp(transform.x, Math.max(0,width*(zoom-1)/2)), y:clamp(transform.y, Math.max(0,height*(zoom-1)/2)) };
}
export function movePhoto(initial: PhotoTransform, from: PhotoPoint[], to: PhotoPoint[], width: number, height: number): PhotoTransform {
  if (!from.length || from.length !== to.length) return initial;
  const middle = (p: PhotoPoint[]) => ({x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length});
  const distance = (p: PhotoPoint[]) => p.length>1 ? Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y) : 0;
  const a=middle(from),b=middle(to), zoom=Math.max(1,Math.min(4,initial.zoom*(distance(from)>0?distance(to)/distance(from):1))),ratio=zoom/initial.zoom;
  return clampPhoto({zoom,x:b.x-(a.x-initial.x)*ratio,y:b.y-(a.y-initial.y)*ratio},width,height);
}
