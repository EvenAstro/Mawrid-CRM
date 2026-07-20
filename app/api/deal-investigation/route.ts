import { NextRequest, NextResponse } from "next/server";
import { analyzeDeal } from "@/lib/dealInvestigation/analyze";

export async function POST(req: NextRequest) {
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
