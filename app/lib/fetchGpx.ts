import { MAX_GPX_SIZE } from "./gpx";
const HOSTS = new Set(["sarops.info", "res.cloudinary.com"]);
export class GpxFetchError extends Error { constructor(message:string, public status:number){super(message);} }
export async function fetchGpx(url: string): Promise<string> {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    let target:URL;
    try { target=new URL(url); } catch { throw new GpxFetchError("GPX adresa není platná.",400); }
    for(let redirect=0;redirect<4;redirect++){
      if(target.protocol!=="https:" || !HOSTS.has(target.hostname) || target.username || target.password)throw new GpxFetchError("Nepovolený zdroj GPX.",400);
      const response=await fetch(target.toString(),{cache:"no-store",redirect:"manual",signal:controller.signal});
      if(response.status>=300 && response.status<400){
        const location=response.headers.get("location");
        if(!location)throw new GpxFetchError("GPX se nepodařilo načíst.",502);
        await response.body?.cancel();
        target=new URL(location,target);continue;
      }
      if(!response.ok)throw new GpxFetchError("GPX se nepodařilo načíst.",502);
      if(Number(response.headers.get("content-length"))>MAX_GPX_SIZE){await response.body?.cancel();throw new GpxFetchError("GPX soubor je příliš velký.",413);}
      const reader=response.body?.getReader();
      if(!reader)throw new GpxFetchError("GPX soubor je prázdný.",422);
      let size=0;const decoder=new TextDecoder();let text="";
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_GPX_SIZE){await reader.cancel();throw new GpxFetchError("GPX soubor je příliš velký.",413);}text+=decoder.decode(value,{stream:true});}
      return text+decoder.decode();
    }
    throw new GpxFetchError("GPX obsahuje příliš mnoho přesměrování.",502);
  } finally {clearTimeout(timeout);}
}
