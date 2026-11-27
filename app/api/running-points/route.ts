import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin, requireUser } from "../../lib/apiAuth";
import { parseRunningPointsConfig, RUN_POINTS } from "../../lib/runningPointsConfig";

const headers = { "Cache-Control": "private, no-store" };

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

function failure(error: unknown, message: string) {
  const auth = authErrorResponse(error);
  if (!auth) console.error("Nastavení bodování:", error);
  return reply({ error: auth?.message ?? message }, auth?.status ?? 500);
}

export async function GET(request: Request) {
  try {
    const { adminDb } = await requireUser(request);
    const snapshot = await adminDb.doc("appSettings/runningPoints").get();
    if (!snapshot.exists) return reply({ rules: RUN_POINTS });
    const rules = parseRunningPointsConfig(snapshot.data());
    if (!rules) throw new Error("Neplatné uložené nastavení bodování.");
    return reply({ rules });
  } catch (error) {
    return failure(error, "Pravidla bodování se nepodařilo načíst.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { adminDb } = await requireAdmin(request);
    const rules = parseRunningPointsConfig(await request.json().catch(() => null));
    if (!rules) return reply({ error: "Zkontroluj hodnoty v nastavení bodování." }, 400);
    await adminDb.doc("appSettings/runningPoints").set(rules);
    return reply({ rules });
  } catch (error) {
    return failure(error, "Pravidla bodování se nepodařilo uložit.");
  }
}
