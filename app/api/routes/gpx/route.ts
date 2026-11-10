import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedHosts = new Set(["sarops.info"]);
const MAX_GPX_SIZE = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function GET(request: Request) {
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Chybí GPX adresa." }, { status: 400 });
    }

    const target = new URL(url);
    if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
      return NextResponse.json({ error: "Nepovolený zdroj GPX." }, { status: 400 });
    }

    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(target.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/gpx+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "Dolni-Lhota-v-pohybu/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "GPX se nepodařilo načíst." }, { status: 502 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_GPX_SIZE) {
      return NextResponse.json({ error: "GPX soubor je příliš velký." }, { status: 413 });
    }

    const text = await response.text();
    if (text.length > MAX_GPX_SIZE) {
      return NextResponse.json({ error: "GPX soubor je příliš velký." }, { status: 413 });
    }

    if (!/<(?:\w+:)?gpx[\s>]/i.test(text) || !/<(?:\w+:)?trkpt[\s>]/i.test(text)) {
      return NextResponse.json({ error: "Zdroj neobsahuje platnou GPX trasu." }, { status: 422 });
    }

    return new NextResponse(text, {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Načítání GPX trvalo příliš dlouho." }, { status: 504 });
    }

    return NextResponse.json({ error: "GPX se nepodařilo načíst." }, { status: 500 });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
