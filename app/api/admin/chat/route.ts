import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "../../../lib/apiAuth";
import { chatState } from "../../../lib/chatAvailability";

export async function PATCH(request: Request) {
  try {
    const { adminDb } = await requireAdmin(request);
    const body = await request.json().catch(() => null);
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "Zvol, zda má být chat zapnutý." }, { status: 400 });
    }
    await chatState(adminDb).set({ enabled: body.enabled }, { merge: true });
    return NextResponse.json({ enabled: body.enabled });
  } catch (error) {
    const authError = authErrorResponse(error);
    return NextResponse.json({ error: authError?.message || "Nastavení chatu se nepodařilo uložit." },
      { status: authError?.status ?? 500 });
  }
}
