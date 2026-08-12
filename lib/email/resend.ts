/**
 * Thin wrapper over the Resend REST API — no SDK dependency needed for one
 * call. Same shape as lib/whatsapp/client.ts: read the key from env, fail
 * soft (log, don't throw) so a broken email integration never takes down
 * whatever feature triggered it.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set");
    return { ok: false, error: "email not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error("[email] send failed", data);
      return { ok: false, error: JSON.stringify(data) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { ok: false, error: String(err) };
  }
}
