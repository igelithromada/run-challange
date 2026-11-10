import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedHosts = new Set(["sarops.info"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Chybí GPX adresa." }, { status: 400 });
    }

    const target = new URL(url);
    if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
      return NextResponse.json({ error: "Nepovolený zdroj GPX." }, { status: 400 });
    }

    const response = await fetch(target.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/gpx+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "Dolni-Lhota-v-pohybu/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "GPX se nepodařilo načíst." }, { status: 502 });
    }

    const text = await response.text();
    if (!/<(?:\w+:)?gpx[\s>]/i.test(text) || !/<(?:\w+:)?trkpt[\s>]/i.test(text)) {
      return NextResponse.json({ error: "Zdroj neobsahuje platnou GPX trasu." }, { status: 422 });
    }

    return new NextResponse(text, {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "GPX se nepodařilo načíst." }, { status: 500 });
  }
}
