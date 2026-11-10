import { NextResponse } from "next/server";
import webpush from "web-push";
import { getAdminServices } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function planFor(data:any,type:"běh"|"chůze",key:string) {
  const plans=data?.personalTrainerPlans?.[type];
  return plans && typeof plans==="object" ? plans[monthKey(new Date(key+"T12:00:00"))] : null;
}
function plannedText(plan:any,key:string) {
  const km=Number(plan?.dayKm?.[key]||0);
  return km>0 ? `${plan.type==="chůze"?"Chůze":"Běh"} · ${km.toFixed(1)} km` : "";
}

export async function GET(request:Request) {
  try {
    const secret=process.env.CRON_SECRET||"";
    const authHeader=request.headers.get("authorization")||"";
    if(secret && authHeader!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});

    const publicKey=process.env.VAPID_PUBLIC_KEY||"";
    const privateKey=process.env.VAPID_PRIVATE_KEY||"";
    const subject=process.env.VAPID_SUBJECT||"mailto:radek@example.com";
    if(!publicKey||!privateKey) throw new Error("Chybí VAPID klíče.");

    webpush.setVapidDetails(subject,publicKey,privateKey);
    const {adminDb}=getAdminServices();
    const now=new Date();
    const hour=now.getUTCHours();
    const isToday=hour<12;
    const target=new Date(now);
    if(!isToday) target.setDate(target.getDate()+1);
    const targetKey=dateKey(target);
    const snapshot=await adminDb.collection("users").get();
    let sent=0,failed=0;

    for(const userDoc of snapshot.docs){
      const data=userDoc.data()||{};
      const prefs=data.trainerNotifications||{};
      if(prefs.enabled!==true) continue;
      if(isToday ? prefs.today!==true : prefs.tomorrow!==true) continue;

      const texts=(["běh","chůze"] as const)
        .map(type=>planFor(data,type,targetKey))
        .map(plan=>plan?plannedText(plan,targetKey):"")
        .filter(Boolean);
      if(!texts.length) continue;

      const subscriptions=await userDoc.ref.collection("pushSubscriptions").get();
      for(const subDoc of subscriptions.docs){
        try{
          await webpush.sendNotification(subDoc.data() as any,JSON.stringify({
            title:isToday?"Dnešní plán":"Zítřejší plán",
            body:texts.join("  ·  "),
            tag:`trainer-${isToday?"today":"tomorrow"}-${targetKey}`,
            url:"/trainer"
          }));
          sent++;
        }catch(error:any){
          failed++;
          const code=Number(error?.statusCode||0);
          if(code===404||code===410) await subDoc.ref.delete().catch(()=>{});
        }
      }
    }
    return NextResponse.json({ok:true,sent,failed,target:targetKey,mode:isToday?"today":"tomorrow"});
  }catch(error){
    console.error("GET /api/notifications/trainer:",error);
    return NextResponse.json({error:"Notifikace trenéra se nepodařilo odeslat."},{status:500});
  }
}
