import { NextRequest, NextResponse } from "next/server";
import { analyzeDeal } from "@/lib/dealInvestigation/analyze";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(`${caller.id}:deal-investigation`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { dealId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.dealId;
  if (!dealId || typeof dealId !== "string") {
    return NextResponse.json({ error: "dealId is required" }, { status: 400 });
  }

  const payload = await analyzeDeal(dealId);
  if (!payload) {
    return NextResponse.json({ error: `Deal ${dealId} not found` }, { status: 404 });
  }

  return NextResponse.json(payload);
}
