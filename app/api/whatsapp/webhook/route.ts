import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import crypto from "node:crypto";
import { claimInboundMessage } from "@/lib/models/whatsappAgent";
import { enqueueInbound } from "@/lib/whatsapp/queue";
import { drainWhatsAppQueue } from "@/lib/whatsapp/processor";

/**
 * WhatsApp Cloud API webhook — sandbox test number only.
 *
 * The route's job is to acknowledge Meta within a second and log what
 * arrived. The model loop that composes the reply runs in the background
 * task scheduled with after() — Meta stops retrying because it saw a 200,
 * and the customer's message is answered on the same request without the
 * customer having to wait for the whole loop to finish before the webhook
 * returns. Anything after() drops (cold shutdown, container recycle) is
 * caught by the queue's cron sweeper on the next tick.
 *
 * Two request shapes from Meta, handled the way the platform requires:
 *
 *   GET  — the one-time verification handshake when you register the URL
 *          in the Meta app dashboard. Echoes hub.challenge back on match.
 *
 *   POST — actual events. Every POST body is signed with the app secret;
 *          a request whose signature doesn't match is rejected before
 *          anything in it is trusted.
 */

/**
 * The 200 goes back to Meta in milliseconds, but the after() task keeps
 * running past it — and the platform kills the invocation at the default
 * limit regardless of the response already being sent. A turn that calls
 * two or three tools plus a model round per tool needs well past 10
 * seconds, and when the ceiling hits mid-turn the queue row is left in
 * 'processing' with no reply sent. 60 is the Hobby maximum.
 */
export const maxDuration = 60;

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

  let enqueued = 0;
  for (const m of messages) {
    if (m.type !== "text" || !m.text?.body) continue;
    const from = m.from;
    const text = m.text.body;

    // Dedupe on the log's unique wa_message_id index — Meta redelivers
    // webhooks it thinks failed, and without this the same message would
    // be enqueued twice and answered twice.
    const isFirstDelivery = await claimInboundMessage({
      waFrom: from,
      body: text,
      waMessageId: m.id ?? null,
    });
    if (!isFirstDelivery) continue;

    await enqueueInbound({ waFrom: from, body: text, waMessageId: m.id ?? null });
    enqueued++;
  }

  // Kick the processor on the same request, after the 200 goes back to
  // Meta. after() runs to completion even though the response has already
  // been sent, which is exactly the shape Meta needs: no wait for the
  // model loop, no retries triggered by our own latency.
  if (enqueued > 0) {
    after(async () => {
      try {
        await drainWhatsAppQueue(enqueued);
      } catch (err) {
        console.error("[whatsapp webhook] background drain threw", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
