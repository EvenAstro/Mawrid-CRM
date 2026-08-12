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
