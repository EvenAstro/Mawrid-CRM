import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { setWhatsAppAgentEnabled } from "@/lib/models/whatsappAgent";

/** The kill switch, reachable from the browser by a signed-in user.
 * Flips instantly — no redeploy, no waiting on Vercel. */
export async function POST(req: NextRequest) {
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  const { error } = await setWhatsAppAgentEnabled(body.enabled);
  if (error) {
    console.error("[whatsapp toggle] update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
