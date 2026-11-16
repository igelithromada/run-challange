import { NextResponse } from "next/server";
import { fetchGpx, GpxFetchError } from "../../../lib/fetchGpx";
import { gpxDistanceLabel } from "../../../lib/gpx";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const url=new URL(request.url).searchParams.get("url");
    if(!url)return NextResponse.json({error:"Chybí GPX adresa."},{status:400});
    const text=await fetchGpx(url);
    if(gpxDistanceLabel(text)===null)return NextResponse.json({error:"Zdroj neobsahuje platnou GPX trasu."},{status:422});
    return new NextResponse(text,{headers:{"Content-Type":"application/gpx+xml; charset=utf-8","Cache-Control":"public, max-age=86400, s-maxage=86400"}});
  }catch(error){
    const status=error instanceof GpxFetchError?error.status:error instanceof Error&&error.name==="AbortError"?504:502;
    return NextResponse.json({error:error instanceof GpxFetchError?error.message:status===504?"Načítání GPX trvalo příliš dlouho.":"GPX se nepodařilo načíst."},{status});
  }
}
