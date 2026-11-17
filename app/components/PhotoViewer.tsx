"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { movePhoto, clampPhoto, type PhotoPoint, type PhotoTransform } from "../lib/photoGesture";

export default function PhotoViewer({url,alt="Fotografie aktivity",onClose,onMove,footer,onDelete,deleting=false}: {
  url:string;alt?:string;onClose:()=>void;onMove:(direction:number)=>void;footer?:ReactNode;onDelete?:()=>void;deleting?:boolean;
}) {
  const dialog=useRef<HTMLDialogElement>(null), pane=useRef<HTMLDivElement>(null);
  const pointers=useRef(new Map<number,PhotoPoint>()), swipe=useRef<PhotoPoint|null>(null), pinched=useRef(false);
  const [transform,setTransform]=useState<PhotoTransform>({zoom:1,x:0,y:0}), current=useRef(transform);
  const update=(next:PhotoTransform)=>{current.current=next;setTransform(next);};
  useEffect(()=>{dialog.current?.showModal();const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=old;};},[]);
  useEffect(()=>{update({zoom:1,x:0,y:0});pointers.current.clear();swipe.current=null;pinched.current=false;},[url]);
  const zoom=(factor:number)=>{const box=pane.current?.getBoundingClientRect();update(clampPhoto({...current.current,zoom:current.current.zoom*factor},box?.width||0,box?.height||0));};
  return <dialog ref={dialog} className="shared-photo-viewer" aria-label="Galerie fotografií" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
    if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();if(!deleting)onMove(event.key==="ArrowLeft"?-1:1);}
    if(event.key==="+"||event.key==="=")zoom(1.5);if(event.key==="-")zoom(1/1.5);
  }}>
    <div className="shared-photo-toolbar"><button type="button" onClick={()=>zoom(1.5)} aria-label="Přiblížit fotografii" disabled={transform.zoom>=4}><ZoomIn size={22}/></button><button type="button" onClick={()=>zoom(1/1.5)} aria-label="Oddálit fotografii" disabled={transform.zoom<=1}><ZoomOut size={22}/></button>{onDelete&&<button type="button" onClick={onDelete} disabled={deleting} aria-label="Smazat fotografii"><Trash2 size={22}/></button>}<button type="button" className="shared-photo-close" onClick={onClose} aria-label="Zavřít fotografii"><X size={25}/></button></div>
    <div ref={pane} className="shared-photo-pane" onDoubleClick={()=>update(transform.zoom>1?{zoom:1,x:0,y:0}:{zoom:2,x:0,y:0})} onPointerDown={event=>{
      const rect=event.currentTarget.getBoundingClientRect();const point={x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2};
      event.currentTarget.setPointerCapture(event.pointerId);pointers.current.set(event.pointerId,point);
      if(pointers.current.size===1){swipe.current=point;pinched.current=false;}else {pinched.current=true;swipe.current=null;}
    }} onPointerMove={event=>{
      if(!pointers.current.has(event.pointerId))return;
      const rect=event.currentTarget.getBoundingClientRect(), before=[...pointers.current.values()];
      pointers.current.set(event.pointerId,{x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2});
      if(pointers.current.size>1||current.current.zoom>1)update(movePhoto(current.current,before,[...pointers.current.values()],rect.width,rect.height));
    }} onPointerUp={event=>{
      const rect=event.currentTarget.getBoundingClientRect(),first=swipe.current;
      pointers.current.delete(event.pointerId);
      if(!pointers.current.size){
        const dx=event.clientX-rect.left-rect.width/2-(first?.x||0),dy=event.clientY-rect.top-rect.height/2-(first?.y||0);
        if(first&&!pinched.current&&current.current.zoom===1&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5&&!deleting)onMove(dx<0?1:-1);
        swipe.current=null;
      }
    }} onPointerCancel={()=>{pointers.current.clear();swipe.current=null;pinched.current=true;}}>
      <img src={cloudinaryImageUrl(url,1600)} alt={alt} draggable={false} style={{transform:`translate(${transform.x}px,${transform.y}px) scale(${transform.zoom})`}}/>
    </div>
    <footer className="shared-photo-footer">{footer}<small>Přejetím změníš fotku, dvěma prsty ji přiblížíš.</small></footer>
  </dialog>;
}
