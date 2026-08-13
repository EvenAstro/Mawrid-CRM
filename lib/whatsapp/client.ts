/**
 * Thin wrapper over the WhatsApp Cloud API — sending only. Receiving lives in
 * the webhook route, which is a different surface (Meta calling us, not us
 * calling Meta) and has its own auth story (signature verification, not a
 * bearer token).
 *
 * Sandbox-only. WHATSAPP_PHONE_NUMBER_ID here is the test number Meta issues
 * free with every developer app — this file has no knowledge of whether a
 * number is a test number or a real one; that boundary is a business
 * decision (which number you put in the env var), not a code path.
 */

const GRAPH_VERSION = "v21.0";

function endpoint(phoneNumberId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
}

/**
 * Marks an inbound message as read and shows the "typing…" indicator in
 * WhatsApp until the reply lands. Cosmetic but the whole point is
 * perceived latency: the model loop still takes seconds, and a customer
 * who sees the typing bubble reads that as "he's answering" instead of
 * "no one's there". Best-effort — a failure here must not block the
 * actual reply, so it swallows errors and returns void.
 */
export async function sendWhatsAppTyping(recipientMessageId: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !recipientMessageId) return;
  try {
    await fetch(endpoint(phoneNumberId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: recipientMessageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch (err) {
    console.warn("[whatsapp] typing indicator failed", err);
  }
}

export async function sendWhatsAppText(to: string, body: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set" };
  }

  try {
    const res = await fetch(endpoint(phoneNumberId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[whatsapp] send failed", data);
      return { ok: false, error: JSON.stringify(data?.error ?? data) };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp] send threw", err);
    return { ok: false, error: String(err) };
  }
}
