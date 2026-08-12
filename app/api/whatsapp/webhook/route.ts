import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { generateWhatsAppReply } from "@/lib/whatsapp/agent";
import {
  isWhatsAppAgentEnabled,
  logWhatsAppMessage,
  claimInboundMessage,
  linkConversationToLead,
} from "@/lib/models/whatsappAgent";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * WhatsApp Cloud API webhook — sandbox test number only.
 *
 * Two request shapes from Meta, handled the way the platform requires:
 *
 *   GET  — the one-time verification handshake when you register this URL
 *          in the Meta app dashboard. Echoes back hub.challenge if the
 *          verify token matches.
 *
 *   POST — actual events (incoming messages, delivery receipts, ...). Every
 *          POST body is signed with the app secret; a request whose
 *          signature doesn't match is rejected before anything in it is
 *          trusted, the same principle as 64's quote-grounding check —
 *          verify before you act, not after.
 *
 * The kill switch is checked after logging, not before: an inbound message
 * is real regardless of whether the agent is allowed to answer it, so it is
 * always recorded. Only the reply is gated.
 */

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time compare — this is exactly the kind of check a naive ===
  // quietly weakens.
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

interface WhatsAppChangeValue {
  messages?: { from: string; id: string; type: string; text?: { body: string } }[];
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.error("[whatsapp webhook] signature mismatch — rejecting");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    entry?: { changes?: { value?: WhatsAppChangeValue }[] }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const messages =
    body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    if (m.type !== "text" || !m.text?.body) continue;
    const from = m.from;
    const text = m.text.body;

    // Logging the inbound message and claiming the right to answer it are
    // the same write. Meta redelivers a webhook it thinks failed — which
    // includes one that was merely slow, and the model loop often is — so
    // without this the same message got answered twice, the second reply
    // differing because the first was already in the agent's history.
    const isFirstDelivery = await claimInboundMessage({
      waFrom: from,
      body: text,
      waMessageId: m.id ?? null,
    });
    if (!isFirstDelivery) continue;

    // Per-number rate limit — a loop on the other end (or a misbehaving
    // test) must not be able to burn the OpenRouter budget unbounded.
    const rl = checkRateLimit(`whatsapp:${from}`, 20, 60_000);
    if (!rl.allowed) {
      console.warn(`[whatsapp webhook] rate limited for ${from}`);
      continue;
    }

    const enabled = await isWhatsAppAgentEnabled();
    if (!enabled) continue; // logged above; just not replying

    const result = await generateWhatsAppReply(from, text);
    if (!result?.reply) continue;

    const sent = await sendWhatsAppText(from, result.reply);
    if (sent.ok) {
      await logWhatsAppMessage({
        waFrom: from,
        direction: "outbound",
        body: result.reply,
        waMessageId: sent.messageId,
        leadId: result.leadId,
      });
      // Attribute the rest of the thread too, so the CRM view shows the
      // link across the whole conversation and not just from here on.
      if (result.leadId) await linkConversationToLead(from, result.leadId);
    } else {
      console.error("[whatsapp webhook] send failed", sent.error);
    }
  }

  // Meta requires a fast 200 regardless of what happened above, or it will
  // retry the same webhook delivery repeatedly.
  return NextResponse.json({ ok: true });
}
